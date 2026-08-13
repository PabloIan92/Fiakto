import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import type { QuoteWithId } from "@/src/server/repositories/quote-repository";
import { createQuoteRejectHandler } from "@/app/api/requests/[id]/quotes/[quoteId]/reject/handler";

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
  status: "quoted",
};

const pendingQuote: QuoteWithId = {
  id: "quote-1",
  requestId: "request-1",
  professionalId: "pro-1",
  laborArs: 20000,
  materialsArs: 5000,
  description: "Cambio de la canilla y sellado de la conexión.",
  estimatedHours: 2,
  status: "pending",
};

function context() {
  return { params: Promise.resolve({ id: "request-1", quoteId: "quote-1" }) };
}

function call(handler: ReturnType<typeof createQuoteRejectHandler>) {
  return handler(
    new Request("http://localhost/api/requests/request-1/quotes/quote-1/reject", { method: "POST" }),
    context(),
  );
}

function dependencies(options?: {
  role?: "customer" | "professional";
  actorId?: string;
  found?: ServiceRequestWithId | null;
  quote?: QuoteWithId | null;
}) {
  const quoteStatusUpdates: Array<{ id: string; status: string }> = [];
  const audits: Array<Record<string, unknown>> = [];
  return {
    quoteStatusUpdates,
    audits,
    deps: {
      authenticate: async () => ({
        id: options?.actorId ?? "customer-1",
        role: options?.role ?? ("customer" as const),
      }),
      repository: {
        get: async () => (options?.found === undefined ? openInLanus : options.found),
      },
      quoteRepository: {
        get: async () => (options?.quote === undefined ? pendingQuote : options.quote),
        updateStatus: async (id: string, status: string) => {
          quoteStatusUpdates.push({ id, status });
        },
      },
      appendAudit: async (event: Record<string, unknown>) => {
        audits.push(event);
      },
    },
  };
}

describe("POST /api/requests/:id/quotes/:quoteId/reject", () => {
  it("returns 401 when the actor isn't the customer", async () => {
    const { deps } = dependencies({ role: "professional", actorId: "pro-1" });
    const response = await call(createQuoteRejectHandler(deps));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the request doesn't exist or isn't owned by this customer", async () => {
    const { deps } = dependencies({ found: null });
    const response = await call(createQuoteRejectHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 when the request belongs to someone else", async () => {
    const { deps } = dependencies({ actorId: "someone-else" });
    const response = await call(createQuoteRejectHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 when the quote doesn't exist or belongs to another request", async () => {
    const { deps } = dependencies({ quote: null });
    const response = await call(createQuoteRejectHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 409 when the quote isn't pending anymore", async () => {
    const { deps } = dependencies({ quote: { ...pendingQuote, status: "accepted" } });
    const response = await call(createQuoteRejectHandler(deps));
    expect(response.status).toBe(409);
  });

  it("rejects the quote and appends an audit event, without touching other quotes or the request status", async () => {
    const { deps, quoteStatusUpdates, audits } = dependencies();
    const response = await call(createQuoteRejectHandler(deps));

    expect(response.status).toBe(200);
    expect(quoteStatusUpdates).toEqual([{ id: "quote-1", status: "rejected" }]);
    expect(audits[0]).toMatchObject({ action: "quote.rejected", entityId: "request-1" });
  });
});
