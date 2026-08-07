import { describe, expect, it } from "vitest";

import type { ServiceRequest } from "@/src/domain/requests";
import { createRequestsPostHandler } from "@/app/api/requests/handler";

function request(body: Record<string, unknown>) {
  return new Request("http://localhost/api/requests", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

const validBody = {
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: {
    lat: -34.6,
    lng: -58.4,
    displayRadiusKm: 3,
    province: "Buenos Aires",
    locality: "Lanús",
  },
  media: [],
};

function dependencies(actorId: string | null = "customer-1") {
  const created: ServiceRequest[] = [];
  const audits: Array<Record<string, unknown>> = [];

  return {
    created,
    audits,
    deps: {
      authenticate: async () =>
        actorId ? { id: actorId, role: "customer" as const } : null,
      repository: {
        create: async (input: ServiceRequest) => {
          created.push(input);
          return { id: "request-1" };
        },
        saveTriage: async () => undefined,
      },
      appendAudit: async (event: Record<string, unknown>) => {
        audits.push(event);
      },
    },
  };
}

describe("POST /api/requests", () => {
  it("returns 401 without an authenticated session", async () => {
    const { deps } = dependencies(null);
    const handler = createRequestsPostHandler(deps);

    const response = await handler(request(validBody));

    expect(response.status).toBe(401);
  });

  it("returns 400 for a description shorter than 20 characters", async () => {
    const { deps } = dependencies();
    const handler = createRequestsPostHandler(deps);

    const response = await handler(request({ ...validBody, description: "Pierde agua" }));

    expect(response.status).toBe(400);
  });

  it("creates a request using the customer id from the session", async () => {
    const { deps, created } = dependencies("verified-customer");
    const handler = createRequestsPostHandler(deps);

    const response = await handler(
      request({ ...validBody, customerId: "attacker-controlled-id" }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toEqual({ id: "request-1" });
    expect(created[0]?.customerId).toBe("verified-customer");
  });

  it("appends request.created without exposing request contents", async () => {
    const { deps, audits } = dependencies();
    const handler = createRequestsPostHandler(deps);

    await handler(request(validBody));

    expect(audits).toEqual([
      {
        actorId: "customer-1",
        actorRole: "customer",
        action: "request.created",
        entityType: "request",
        entityId: "request-1",
      },
    ]);
  });
});
