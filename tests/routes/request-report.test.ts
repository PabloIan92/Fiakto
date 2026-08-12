import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import { createRequestReportPostHandler } from "@/app/api/requests/[id]/report/handler";

const acceptedRequest: ServiceRequestWithId = {
  id: "request-1",
  customerId: "customer-1",
  professionalId: "pro-1",
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: { lat: -34.6, lng: -58.4, displayRadiusKm: 3, province: "Buenos Aires", locality: "Lanús" },
  media: [],
  status: "accepted",
};

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

function call(
  handler: ReturnType<typeof createRequestReportPostHandler>,
  body: unknown = { reason: "El profesional nunca llegó a la casa." },
) {
  return handler(
    new Request("http://localhost/api/requests/request-1/report", {
      method: "POST",
      body: JSON.stringify(body),
    }),
    context(),
  );
}

function dependencies(options?: {
  role?: "customer" | "professional";
  actorId?: string;
  found?: ServiceRequestWithId | null;
}) {
  const created: Array<Record<string, unknown>> = [];
  const audits: Array<Record<string, unknown>> = [];
  const alerts: string[] = [];
  return {
    created,
    audits,
    alerts,
    deps: {
      authenticate: async () => ({
        id: options?.actorId ?? "customer-1",
        role: options?.role ?? ("customer" as const),
      }),
      repository: {
        get: async () => (options?.found === undefined ? acceptedRequest : options.found),
      },
      reportRepository: {
        create: async (report: Record<string, unknown>) => {
          created.push(report);
          return { id: "report-1" };
        },
      },
      appendAudit: async (event: Record<string, unknown>) => {
        audits.push(event);
      },
      sendAlert: async (text: string) => {
        alerts.push(text);
      },
    },
  };
}

describe("POST /api/requests/:id/report", () => {
  it("returns 401 for an unauthenticated actor", async () => {
    const { deps } = dependencies();
    const response = await call(
      createRequestReportPostHandler({ ...deps, authenticate: async () => null }),
    );
    expect(response.status).toBe(401);
  });

  it("returns 404 for a request that doesn't exist", async () => {
    const { deps } = dependencies({ found: null });
    const response = await call(createRequestReportPostHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a customer who doesn't own the request", async () => {
    const { deps } = dependencies({ actorId: "someone-else" });
    const response = await call(createRequestReportPostHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a professional who isn't the one assigned", async () => {
    const { deps } = dependencies({ role: "professional", actorId: "pro-2" });
    const response = await call(createRequestReportPostHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 400 when there is no accepted engagement yet", async () => {
    const { deps } = dependencies({ found: { ...acceptedRequest, status: "quoted", professionalId: undefined } });
    const response = await call(createRequestReportPostHandler(deps));
    expect(response.status).toBe(400);
  });

  it("returns 400 for a reason shorter than 10 characters", async () => {
    const { deps } = dependencies();
    const response = await call(createRequestReportPostHandler(deps), { reason: "corto" });
    expect(response.status).toBe(400);
  });

  it("creates the report, appends an audit event and sends a Telegram alert", async () => {
    const { deps, created, audits, alerts } = dependencies();
    const response = await call(createRequestReportPostHandler(deps));

    expect(response.status).toBe(200);
    expect(created).toEqual([
      {
        requestId: "request-1",
        reporterId: "customer-1",
        reporterRole: "customer",
        reason: "El profesional nunca llegó a la casa.",
        status: "open",
      },
    ]);
    expect(audits[0]).toMatchObject({ action: "dispute.reported", entityId: "request-1" });
    expect(alerts[0]).toContain("request-1");
  });

  it("lets the assigned professional report the same engagement", async () => {
    const { deps } = dependencies({ role: "professional", actorId: "pro-1" });
    const response = await call(createRequestReportPostHandler(deps));
    expect(response.status).toBe(200);
  });
});
