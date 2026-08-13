import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import { createRequestPutHandler } from "@/app/api/requests/[id]/handler";

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

const editBody = {
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: {
    lat: -32.9,
    lng: -60.6,
    displayRadiusKm: 3,
    province: "Santa Fe",
    locality: "Rosario",
  },
};

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

function call(handler: ReturnType<typeof createRequestPutHandler>, body: unknown = editBody) {
  return handler(
    new Request("http://localhost/api/requests/request-1", {
      method: "PUT",
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
  const updates: Array<{ id: string; input: Record<string, unknown> }> = [];
  const audits: Array<Record<string, unknown>> = [];
  return {
    updates,
    audits,
    deps: {
      authenticate: async () => ({
        id: options?.actorId ?? "customer-1",
        role: options?.role ?? ("customer" as const),
      }),
      repository: {
        get: async () => (options?.found === undefined ? openInLanus : options.found),
        updateDetails: async (id: string, input: Record<string, unknown>) => {
          updates.push({ id, input });
        },
      },
      appendAudit: async (event: Record<string, unknown>) => {
        audits.push(event);
      },
    },
  };
}

describe("PUT /api/requests/:id", () => {
  it("returns 401 when the actor isn't an authenticated customer", async () => {
    const { deps } = dependencies({ role: "professional" });
    const response = await call(createRequestPutHandler(deps));
    expect(response.status).toBe(401);
  });

  it("returns 404 for a request that doesn't exist or isn't owned by this customer", async () => {
    const { deps } = dependencies({ found: null });
    const response = await call(createRequestPutHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 for a request belonging to someone else", async () => {
    const { deps } = dependencies({ actorId: "someone-else" });
    const response = await call(createRequestPutHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 400 once the request has been accepted (no longer editable)", async () => {
    const { deps } = dependencies({ found: { ...openInLanus, status: "accepted" } });
    const response = await call(createRequestPutHandler(deps));
    expect(response.status).toBe(400);
  });

  it("returns 400 for a description shorter than 20 characters", async () => {
    const { deps } = dependencies();
    const response = await call(createRequestPutHandler(deps), { ...editBody, description: "muy corta" });
    expect(response.status).toBe(400);
  });

  it("returns 400 for an invalid location", async () => {
    const { deps } = dependencies();
    const response = await call(createRequestPutHandler(deps), {
      ...editBody,
      location: { ...editBody.location, lat: 200 },
    });
    expect(response.status).toBe(400);
  });

  it("updates location without resetting triage when the description is unchanged", async () => {
    const { deps, updates, audits } = dependencies();
    const response = await call(createRequestPutHandler(deps));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "ok", resetTriage: false });
    expect(updates).toEqual([
      {
        id: "request-1",
        input: { description: editBody.description, location: editBody.location, resetTriage: false },
      },
    ]);
    expect(audits[0]).toMatchObject({ action: "request.edited", metadata: { resetTriage: false } });
  });

  it("resets triage when the description changed", async () => {
    const { deps, updates } = dependencies();
    const response = await call(createRequestPutHandler(deps), {
      ...editBody,
      description: "Una descripción completamente distinta de al menos veinte caracteres.",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ resetTriage: true });
    expect(updates[0]?.input.resetTriage).toBe(true);
  });

  it("allows editing a draft that never got triaged", async () => {
    const { deps } = dependencies({ found: { ...openInLanus, status: "draft", triage: undefined } });
    const response = await call(createRequestPutHandler(deps));
    expect(response.status).toBe(200);
  });
});
