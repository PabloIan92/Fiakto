import { describe, expect, it } from "vitest";

import { createAdminPaymentsGetHandler } from "@/app/api/admin/payments/handler";
import { createAdminPaymentSettlePostHandler } from "@/app/api/admin/payments/[id]/settle/handler";

describe("GET /api/admin/payments", () => {
  it("returns 401 for a non-admin actor", async () => {
    const handler = createAdminPaymentsGetHandler({
      authenticate: async () => ({ id: "customer-1", role: "customer" }),
      repository: { listPendingPayouts: async () => [] },
      signMedia: async () => [],
    });
    const response = await handler(new Request("http://localhost/api/admin/payments"));
    expect(response.status).toBe(401);
  });

  it("lists pending transfer payouts with a signed receipt URL when one was submitted", async () => {
    const handler = createAdminPaymentsGetHandler({
      authenticate: async () => ({ id: "admin-1", role: "admin" }),
      repository: {
        listPendingPayouts: async () => [
          {
            id: "request-1",
            customerId: "customer-1",
            description: "La canilla pierde agua.",
            location: { lat: -34.6, lng: -58.4, displayRadiusKm: 3, province: "Buenos Aires", locality: "Lanús" },
            media: [],
            status: "accepted",
            payment: { method: "transfer", subtotalArs: 25000, feeArs: 2000, amountArs: 27000 },
            payoutStatus: "pending",
            paymentReceipt: { storagePath: "payment-receipts/request-1.jpg", mimeType: "image/jpeg" },
          },
        ],
      },
      signMedia: async (paths: string[]) => paths.map((path) => `https://signed.example/${path}`),
    });

    const response = await handler(new Request("http://localhost/api/admin/payments"));
    const body = await response.json();
    expect(body.payments[0]).toMatchObject({
      id: "request-1",
      subtotalArs: 25000,
      feeArs: 2000,
      amountArs: 27000,
      hasReceipt: true,
      paymentReceiptUrl: "https://signed.example/payment-receipts/request-1.jpg",
    });
  });

  it("omits paymentReceiptUrl when no receipt was submitted yet", async () => {
    const handler = createAdminPaymentsGetHandler({
      authenticate: async () => ({ id: "admin-1", role: "admin" }),
      repository: {
        listPendingPayouts: async () => [
          {
            id: "request-1",
            customerId: "customer-1",
            description: "La canilla pierde agua.",
            location: { lat: -34.6, lng: -58.4, displayRadiusKm: 3, province: "Buenos Aires", locality: "Lanús" },
            media: [],
            status: "accepted",
            payment: { method: "transfer", subtotalArs: 25000, feeArs: 2000, amountArs: 27000 },
            payoutStatus: "pending",
          },
        ],
      },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/admin/payments"));
    const body = await response.json();
    expect(body.payments[0].hasReceipt).toBe(false);
    expect(body.payments[0]).not.toHaveProperty("paymentReceiptUrl");
  });
});

describe("POST /api/admin/payments/:id/settle", () => {
  function context() {
    return { params: Promise.resolve({ id: "request-1" }) };
  }

  it("returns 401 for a non-admin actor", async () => {
    const handler = createAdminPaymentSettlePostHandler({
      authenticate: async () => ({ id: "customer-1", role: "customer" }),
      repository: { settlePayout: async () => undefined },
      appendAudit: async () => undefined,
    });
    const response = await handler(
      new Request("http://localhost/api/admin/payments/request-1/settle", { method: "POST" }),
      context(),
    );
    expect(response.status).toBe(401);
  });

  it("settles the payout and appends an audit event", async () => {
    const settled: string[] = [];
    const audits: Array<Record<string, unknown>> = [];
    const handler = createAdminPaymentSettlePostHandler({
      authenticate: async () => ({ id: "admin-1", role: "admin" }),
      repository: {
        settlePayout: async (id: string) => {
          settled.push(id);
        },
      },
      appendAudit: async (event) => {
        audits.push(event);
      },
    });
    const response = await handler(
      new Request("http://localhost/api/admin/payments/request-1/settle", { method: "POST" }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(settled).toEqual(["request-1"]);
    expect(audits[0]).toMatchObject({ action: "payout.settled", entityId: "request-1" });
  });
});
