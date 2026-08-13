import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import type { UserProfile } from "@/src/domain/profile";
import { createRequestsGetHandler } from "@/app/api/requests/handler";

const openInLanus: ServiceRequestWithId = {
  id: "request-1",
  customerId: "customer-1",
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: {
    lat: -34.6,
    lng: -58.4,
    displayRadiusKm: 3,
    province: "Buenos Aires",
    locality: "Lanús",
    exactAddress: "Calle Falsa 123",
  },
  media: [],
  status: "open",
  triage: {
    trade: "plomeria",
    summary: "Pérdida en la canilla.",
    questions: [],
    riskLevel: "normal",
    referenceRangeArs: null,
    confidence: 0.9,
  },
};

function dependencies(
  open: ServiceRequestWithId[],
  profiles: Record<string, UserProfile>,
  ownJobs: ServiceRequestWithId[] = [],
) {
  return {
    authenticate: async (request: Request) => {
      const role = request.headers.get("x-role");
      if (!role) return null;
      return { id: "actor-1", role: role as "customer" | "professional" | "admin" };
    },
    repository: {
      listByCustomer: async () => [],
      listOpen: async () => open,
      listByProfessional: async () => ownJobs,
    },
    profileRepository: {
      get: async (userId: string) => profiles[userId] ?? null,
      upsert: async () => undefined,
      setPhotoPath: async () => undefined,
    },
  };
}

function requestWithRole(role: string) {
  return new Request("http://localhost/api/requests", { headers: { "x-role": role } });
}

describe("GET /api/requests", () => {
  it("returns 401 without an authenticated session", async () => {
    const handler = createRequestsGetHandler(dependencies([], {}));
    const response = await handler(new Request("http://localhost/api/requests"));
    expect(response.status).toBe(401);
  });

  it("strips exactAddress and filters by trade/coverage for a professional", async () => {
    const handler = createRequestsGetHandler(
      dependencies([openInLanus], {
        "actor-1": {
          userId: "actor-1",
          role: "professional",
          phone: "123456",
          trades: ["plomeria"],
          coverage: ["Lanús"],
          photoPath: "profile-photos/actor-1.jpg",
        },
      }),
    );
    const response = await handler(requestWithRole("professional"));
    const data = (await response.json()) as { requests: ServiceRequestWithId[] };

    expect(data.requests).toHaveLength(1);
    expect(data.requests[0].location).not.toHaveProperty("exactAddress");
  });

  it("hides open requests from a professional with no profile photo, even if trade/coverage match", async () => {
    const handler = createRequestsGetHandler(
      dependencies([openInLanus], {
        "actor-1": {
          userId: "actor-1",
          role: "professional",
          phone: "123456",
          trades: ["plomeria"],
          coverage: ["Lanús"],
        },
      }),
    );
    const response = await handler(requestWithRole("professional"));
    const data = (await response.json()) as { requests: ServiceRequestWithId[] };

    expect(data.requests).toHaveLength(0);
  });

  it("hides requests outside the professional's trades/coverage", async () => {
    const handler = createRequestsGetHandler(
      dependencies([openInLanus], {
        "actor-1": {
          userId: "actor-1",
          role: "professional",
          phone: "123456",
          trades: ["electricidad"],
          coverage: ["Lanús"],
        },
      }),
    );
    const response = await handler(requestWithRole("professional"));
    const data = (await response.json()) as { requests: ServiceRequestWithId[] };

    expect(data.requests).toHaveLength(0);
  });

  it("includes the professional's own in-progress jobs even if they no longer match trades/coverage", async () => {
    const ownJob: ServiceRequestWithId = {
      ...openInLanus,
      id: "request-2",
      status: "in_progress",
      professionalId: "actor-1",
      slaDeadline: "2026-08-12T12:00:00.000Z",
    };
    const handler = createRequestsGetHandler(
      dependencies(
        [],
        {
          "actor-1": {
            userId: "actor-1",
            role: "professional",
            phone: "123456",
            trades: ["electricidad"],
            coverage: ["Lanús"],
          },
        },
        [ownJob],
      ),
    );
    const response = await handler(requestWithRole("professional"));
    const data = (await response.json()) as { requests: ServiceRequestWithId[] };

    expect(data.requests).toHaveLength(1);
    expect(data.requests[0]).toMatchObject({ id: "request-2", status: "in_progress" });
  });

  it("skips legacy open requests with no location instead of crashing the whole list", async () => {
    const legacyWithoutLocation = {
      ...openInLanus,
      id: "request-legacy",
      location: undefined,
    } as unknown as ServiceRequestWithId;
    const handler = createRequestsGetHandler(
      dependencies([legacyWithoutLocation, openInLanus], {
        "actor-1": {
          userId: "actor-1",
          role: "professional",
          phone: "123456",
          trades: ["plomeria"],
          coverage: ["Lanús"],
          photoPath: "profile-photos/actor-1.jpg",
        },
      }),
    );
    const response = await handler(requestWithRole("professional"));
    expect(response.status).toBe(200);
    const data = (await response.json()) as { requests: ServiceRequestWithId[] };
    expect(data.requests).toHaveLength(1);
    expect(data.requests[0].id).toBe(openInLanus.id);
  });

  it("hides exactAddress on own jobs until payment is confirmed, reveals it once it is", async () => {
    const notPaid: ServiceRequestWithId = {
      ...openInLanus,
      id: "request-2",
      status: "accepted",
      professionalId: "actor-1",
      payment: { method: "transfer", subtotalArs: 25000, feeArs: 2000, amountArs: 27000 },
    };
    const paid: ServiceRequestWithId = {
      ...openInLanus,
      id: "request-3",
      status: "accepted",
      professionalId: "actor-1",
      payment: { method: "cash", subtotalArs: 25000, feeArs: 2000, amountArs: 27000 },
    };
    const handler = createRequestsGetHandler(
      dependencies([], {}, [notPaid, paid]),
    );
    const response = await handler(requestWithRole("professional"));
    const data = (await response.json()) as { requests: ServiceRequestWithId[] };

    const byId = Object.fromEntries(data.requests.map((item) => [item.id, item]));
    expect(byId["request-2"]?.location).not.toHaveProperty("exactAddress");
    expect(byId["request-3"]?.location?.exactAddress).toBe("Calle Falsa 123");
  });
});
