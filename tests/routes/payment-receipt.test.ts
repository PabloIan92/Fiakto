import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import { createPaymentReceiptPostHandler } from "@/app/api/requests/[id]/payment-receipt/handler";

const pendingTransfer: ServiceRequestWithId = {
  id: "request-1",
  customerId: "customer-1",
  professionalId: "pro-1",
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: { lat: -34.6, lng: -58.4, displayRadiusKm: 3, province: "Buenos Aires", locality: "Lanús" },
  media: [],
  status: "accepted",
  payment: { method: "transfer", subtotalArs: 25000, feeArs: 2000, amountArs: 27000 },
  payoutStatus: "pending",
};

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

function call(
  handler: ReturnType<typeof createPaymentReceiptPostHandler>,
  body: unknown = { photoBase64: Buffer.from("fake-image").toString("base64"), contentType: "image/jpeg" },
) {
  return handler(
    new Request("http://localhost/api/requests/request-1/payment-receipt", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    context(),
  );
}

function dependencies(options?: {
  actorId?: string;
  found?: ServiceRequestWithId | null;
  verdict?: { looksValid: boolean; reason: string } | "throw";
}) {
  const submitted: Array<{ id: string; receipt: Record<string, unknown> }> = [];
  const audits: Array<Record<string, unknown>> = [];
  const verifyCalls: Array<Record<string, unknown>> = [];
  return {
    submitted,
    audits,
    verifyCalls,
    deps: {
      authenticate: async () => ({ id: options?.actorId ?? "customer-1", role: "customer" as const }),
      repository: {
        get: async () => (options?.found === undefined ? pendingTransfer : options.found),
        submitPaymentReceipt: async (id: string, receipt: Record<string, unknown>) => {
          submitted.push({ id, receipt });
        },
      },
      upload: async (_requestId: string, _buffer: Buffer, contentType: string) =>
        `payment-receipts/request-1.${contentType === "image/png" ? "png" : "jpg"}`,
      appendAudit: async (event: Record<string, unknown>) => {
        audits.push(event);
      },
      receiptProvider: {
        verify: async (input: Record<string, unknown>) => {
          verifyCalls.push(input);
          if (options?.verdict === "throw") throw new Error("Gemini down");
          return options?.verdict ?? { looksValid: true, reason: "Coincide monto y alias." };
        },
      },
      paymentAlias: () => "fiakto",
      paymentCbu: () => "3840200500000008745277",
      now: () => new Date("2026-08-16T12:00:00.000Z"),
    },
  };
}

describe("POST /api/requests/:id/payment-receipt", () => {
  it("returns 401 for a non-customer actor", async () => {
    const { deps } = dependencies();
    const response = await call(
      createPaymentReceiptPostHandler({ ...deps, authenticate: async () => ({ id: "pro-1", role: "professional" }) }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for a request that doesn't belong to this customer", async () => {
    const { deps } = dependencies({ actorId: "someone-else" });
    const response = await call(createPaymentReceiptPostHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 400 when the request has no payout to confirm (e.g. cash)", async () => {
    const { deps } = dependencies({ found: { ...pendingTransfer, payment: { method: "cash", subtotalArs: 25000, feeArs: 2000, amountArs: 27000 }, payoutStatus: undefined } });
    const response = await call(createPaymentReceiptPostHandler(deps));
    expect(response.status).toBe(400);
  });

  it("returns 400 when a receipt was already submitted", async () => {
    const { deps } = dependencies({
      found: { ...pendingTransfer, paymentReceipt: { storagePath: "x", mimeType: "image/jpeg" } },
    });
    const response = await call(createPaymentReceiptPostHandler(deps));
    expect(response.status).toBe(400);
  });

  it("uploads the receipt, asks Gemini to review it against the expected amount/alias, stores the verdict and appends an audit event", async () => {
    const { deps, submitted, audits, verifyCalls } = dependencies();
    const response = await call(createPaymentReceiptPostHandler(deps));

    expect(response.status).toBe(200);
    expect(verifyCalls[0]).toMatchObject({
      contentType: "image/jpeg",
      expectedAmountArs: 27000,
      expectedAlias: "fiakto",
      expectedCbu: "3840200500000008745277",
    });
    expect(submitted).toEqual([
      {
        id: "request-1",
        receipt: {
          storagePath: "payment-receipts/request-1.jpg",
          mimeType: "image/jpeg",
          verdict: { looksValid: true, reason: "Coincide monto y alias." },
          reviewedAt: "2026-08-16T12:00:00.000Z",
        },
      },
    ]);
    expect(audits[0]).toMatchObject({ action: "payment_receipt.submitted", entityId: "request-1" });
  });

  it("still stores the receipt if Gemini's review fails — it's advisory only", async () => {
    const { deps, submitted } = dependencies({ verdict: "throw" });
    const response = await call(createPaymentReceiptPostHandler(deps));

    expect(response.status).toBe(200);
    expect(submitted[0].receipt).toMatchObject({ storagePath: "payment-receipts/request-1.jpg" });
    expect(submitted[0].receipt.verdict).toBeUndefined();
  });
});
