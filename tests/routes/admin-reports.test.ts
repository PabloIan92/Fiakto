import { describe, expect, it } from "vitest";

import { createAdminReportsGetHandler } from "@/app/api/admin/reports/handler";
import { createAdminReportResolvePostHandler } from "@/app/api/admin/reports/[id]/resolve/handler";

describe("GET /api/admin/reports", () => {
  it("returns 401 for a non-admin actor", async () => {
    const handler = createAdminReportsGetHandler({
      authenticate: async () => ({ id: "customer-1", role: "customer" }),
      reportRepository: { listAll: async () => [] },
      repository: { get: async () => null },
    });
    const response = await handler(new Request("http://localhost/api/admin/reports"));
    expect(response.status).toBe(401);
  });

  it("enriches each report with a summary of its request", async () => {
    const handler = createAdminReportsGetHandler({
      authenticate: async () => ({ id: "admin-1", role: "admin" }),
      reportRepository: {
        listAll: async () => [
          {
            id: "report-1",
            requestId: "request-1",
            reporterId: "customer-1",
            reporterRole: "customer",
            reason: "El profesional nunca llegó.",
            status: "open",
          },
        ],
      },
      repository: {
        get: async () => ({
          id: "request-1",
          customerId: "customer-1",
          description: "La canilla pierde agua.",
          location: { lat: -34.6, lng: -58.4, displayRadiusKm: 3, province: "Buenos Aires", locality: "Lanús" },
          media: [],
          status: "accepted",
        }),
      },
    });

    const response = await handler(new Request("http://localhost/api/admin/reports"));
    const body = await response.json();
    expect(body.reports[0]).toMatchObject({
      id: "report-1",
      request: { description: "La canilla pierde agua.", province: "Buenos Aires", locality: "Lanús", status: "accepted" },
    });
  });

  it("returns null request for a report whose request no longer exists", async () => {
    const handler = createAdminReportsGetHandler({
      authenticate: async () => ({ id: "admin-1", role: "admin" }),
      reportRepository: {
        listAll: async () => [
          {
            id: "report-1",
            requestId: "missing",
            reporterId: "customer-1",
            reporterRole: "customer",
            reason: "El profesional nunca llegó.",
            status: "open",
          },
        ],
      },
      repository: { get: async () => null },
    });

    const response = await handler(new Request("http://localhost/api/admin/reports"));
    const body = await response.json();
    expect(body.reports[0].request).toBeNull();
  });
});

describe("POST /api/admin/reports/:id/resolve", () => {
  function context() {
    return { params: Promise.resolve({ id: "report-1" }) };
  }

  it("returns 401 for a non-admin actor", async () => {
    const handler = createAdminReportResolvePostHandler({
      authenticate: async () => ({ id: "customer-1", role: "customer" }),
      reportRepository: { resolve: async () => undefined },
      appendAudit: async () => undefined,
    });
    const response = await handler(
      new Request("http://localhost/api/admin/reports/report-1/resolve", {
        method: "POST",
        body: JSON.stringify({ note: "Se contactó a ambas partes." }),
      }),
      context(),
    );
    expect(response.status).toBe(401);
  });

  it("returns 400 for an empty note", async () => {
    const handler = createAdminReportResolvePostHandler({
      authenticate: async () => ({ id: "admin-1", role: "admin" }),
      reportRepository: { resolve: async () => undefined },
      appendAudit: async () => undefined,
    });
    const response = await handler(
      new Request("http://localhost/api/admin/reports/report-1/resolve", {
        method: "POST",
        body: JSON.stringify({ note: "" }),
      }),
      context(),
    );
    expect(response.status).toBe(400);
  });

  it("resolves the report with a note and appends an audit event", async () => {
    const resolved: Array<{ id: string; note: string }> = [];
    const audits: Array<Record<string, unknown>> = [];
    const handler = createAdminReportResolvePostHandler({
      authenticate: async () => ({ id: "admin-1", role: "admin" }),
      reportRepository: {
        resolve: async (id: string, note: string) => {
          resolved.push({ id, note });
        },
      },
      appendAudit: async (event) => {
        audits.push(event);
      },
    });
    const response = await handler(
      new Request("http://localhost/api/admin/reports/report-1/resolve", {
        method: "POST",
        body: JSON.stringify({ note: "Se contactó a ambas partes." }),
      }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(resolved).toEqual([{ id: "report-1", note: "Se contactó a ambas partes." }]);
    expect(audits[0]).toMatchObject({ action: "dispute.resolved", entityId: "report-1" });
  });
});
