import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import { createRequestCloseHandler } from "@/app/api/requests/[id]/close/handler";

const completedWithPhoto: ServiceRequestWithId = {
  id: "request-1",
  customerId: "customer-1",
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: {
    lat: -34.6,
    lng: -58.4,
    displayRadiusKm: 3,
    province: "Buenos Aires",
    locality: "Lanús",
  },
  media: [],
  status: "completed",
  professionalId: "pro-1",
  completionMedia: { storagePath: "requests/pro-1/done.jpg", mimeType: "image/jpeg" },
};

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

function call(handler: ReturnType<typeof createRequestCloseHandler>, body?: unknown) {
  return handler(
    new Request("http://localhost/api/requests/request-1/close", {
      method: "POST",
      body: body === undefined ? undefined : JSON.stringify(body),
    }),
    context(),
  );
}

function dependencies(options?: {
  role?: "customer" | "professional";
  actorId?: string;
  found?: ServiceRequestWithId | null;
}) {
  const closed: Array<{ id: string; review?: { stars: number; comment?: string } }> = [];
  const audits: Array<Record<string, unknown>> = [];
  return {
    closed,
    audits,
    deps: {
      authenticate: async () => ({
        id: options?.actorId ?? "customer-1",
        role: options?.role ?? ("customer" as const),
      }),
      repository: {
        get: async () => (options?.found === undefined ? completedWithPhoto : options.found),
        closeRequest: async (id: string, review?: { stars: number; comment?: string }) => {
          closed.push({ id, review });
        },
      },
      appendAudit: async (event: Record<string, unknown>) => {
        audits.push(event);
      },
    },
  };
}

describe("POST /api/requests/:id/close", () => {
  it("returns 401 when the actor isn't the customer", async () => {
    const { deps } = dependencies({ role: "professional", actorId: "pro-1" });
    const response = await call(createRequestCloseHandler(deps));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the request doesn't exist or isn't owned by this customer", async () => {
    const { deps } = dependencies({ found: null });
    const response = await call(createRequestCloseHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 when the request belongs to someone else", async () => {
    const { deps } = dependencies({ actorId: "someone-else" });
    const response = await call(createRequestCloseHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 409 when the request isn't completed yet", async () => {
    const { deps } = dependencies({ found: { ...completedWithPhoto, status: "in_progress" } });
    const response = await call(createRequestCloseHandler(deps));
    expect(response.status).toBe(409);
  });

  it("returns 400 when the professional never submitted a completion photo", async () => {
    const { deps } = dependencies({ found: { ...completedWithPhoto, completionMedia: undefined } });
    const response = await call(createRequestCloseHandler(deps));
    expect(response.status).toBe(400);
  });

  it("closes the request without a review when none is sent", async () => {
    const { deps, closed, audits } = dependencies();
    const response = await call(createRequestCloseHandler(deps));

    expect(response.status).toBe(200);
    expect(closed).toEqual([{ id: "request-1", review: undefined }]);
    expect(audits[0]).toMatchObject({
      action: "request.closed",
      entityId: "request-1",
      metadata: { hasReview: false },
    });
  });

  it("closes the request with a star rating and comment", async () => {
    const { deps, closed, audits } = dependencies();
    const response = await call(createRequestCloseHandler(deps), {
      review: { stars: 5, comment: "Excelente trabajo, muy prolijo." },
    });

    expect(response.status).toBe(200);
    expect(closed).toEqual([
      { id: "request-1", review: { stars: 5, comment: "Excelente trabajo, muy prolijo." } },
    ]);
    expect(audits[0]).toMatchObject({ metadata: { hasReview: true } });
  });

  it("closes the request with just a star rating, no comment", async () => {
    const { deps, closed } = dependencies();
    const response = await call(createRequestCloseHandler(deps), { review: { stars: 3 } });

    expect(response.status).toBe(200);
    expect(closed).toEqual([{ id: "request-1", review: { stars: 3, comment: undefined } }]);
  });

  it("returns 400 for a rating outside 1-5", async () => {
    const { deps } = dependencies();
    const response = await call(createRequestCloseHandler(deps), { review: { stars: 6 } });
    expect(response.status).toBe(400);
  });
});
