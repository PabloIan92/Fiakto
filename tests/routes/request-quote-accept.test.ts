import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import type { QuoteWithId } from "@/src/server/repositories/quote-repository";
import { createQuoteAcceptHandler } from "@/app/api/requests/[id]/quotes/[quoteId]/accept/handler";

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

const otherPendingQuote: QuoteWithId = {
  ...pendingQuote,
  id: "quote-2",
  professionalId: "pro-2",
};

function context() {
  return { params: Promise.resolve({ id: "request-1", quoteId: "quote-1" }) };
}

function call(
  handler: ReturnType<typeof createQuoteAcceptHandler>,
  body: unknown = { paymentMethod: "cash" },
) {
  return handler(
    new Request("http://localhost/api/requests/request-1/quotes/quote-1/accept", {
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
  quote?: QuoteWithId | null;
  allQuotes?: QuoteWithId[];
}) {
  const statusUpdates: Array<{ id: string; input: Record<string, unknown> }> = [];
  const payments: Array<{ id: string; input: Record<string, unknown> }> = [];
  const quoteStatusUpdates: Array<{ id: string; status: string }> = [];
  const audits: Array<Record<string, unknown>> = [];
  return {
    statusUpdates,
    payments,
    quoteStatusUpdates,
    audits,
    deps: {
      authenticate: async () => ({
        id: options?.actorId ?? "customer-1",
        role: options?.role ?? ("customer" as const),
      }),
      repository: {
        get: async () => (options?.found === undefined ? openInLanus : options.found),
        updateStatus: async (id: string, input: Record<string, unknown>) => {
          statusUpdates.push({ id, input });
        },
        recordPayment: async (id: string, input: Record<string, unknown>) => {
          payments.push({ id, input });
        },
      },
      quoteRepository: {
        get: async () => (options?.quote === undefined ? pendingQuote : options.quote),
        listByRequest: async () => options?.allQuotes ?? [pendingQuote, otherPendingQuote],
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

describe("POST /api/requests/:id/quotes/:quoteId/accept", () => {
  it("returns 401 when the actor isn't the customer", async () => {
    const { deps } = dependencies({ role: "professional", actorId: "pro-1" });
    const response = await call(createQuoteAcceptHandler(deps));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the request doesn't exist or isn't owned by this customer", async () => {
    const { deps } = dependencies({ found: null });
    const response = await call(createQuoteAcceptHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 when the request belongs to someone else", async () => {
    const { deps } = dependencies({ actorId: "someone-else" });
    const response = await call(createQuoteAcceptHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 when the quote doesn't exist or belongs to another request", async () => {
    const { deps } = dependencies({ quote: null });
    const response = await call(createQuoteAcceptHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 404 when the quote belongs to a different request", async () => {
    const { deps } = dependencies({ quote: { ...pendingQuote, requestId: "request-other" } });
    const response = await call(createQuoteAcceptHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 409 when the quote isn't pending anymore", async () => {
    const { deps } = dependencies({ quote: { ...pendingQuote, status: "rejected" } });
    const response = await call(createQuoteAcceptHandler(deps));
    expect(response.status).toBe(409);
  });

  it("returns 400 when the payment method is missing or invalid", async () => {
    const { deps } = dependencies();
    const response = await call(createQuoteAcceptHandler(deps), { paymentMethod: "bitcoin" });
    expect(response.status).toBe(400);
  });

  it("accepts the quote, rejects the other pending ones, assigns the professional and appends an audit event", async () => {
    const { deps, statusUpdates, quoteStatusUpdates, audits } = dependencies();
    const response = await call(createQuoteAcceptHandler(deps));

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "accepted", professionalId: "pro-1" });

    expect(quoteStatusUpdates).toEqual(
      expect.arrayContaining([
        { id: "quote-1", status: "accepted" },
        { id: "quote-2", status: "rejected" },
      ]),
    );
    expect(statusUpdates[0]).toMatchObject({
      id: "request-1",
      input: { status: "accepted", professionalId: "pro-1" },
    });
    expect(audits[0]).toMatchObject({ action: "quote.accepted", entityId: "request-1" });
  });

  it("doesn't touch quotes that were already rejected", async () => {
    const alreadyRejected = { ...otherPendingQuote, status: "rejected" as const };
    const { deps, quoteStatusUpdates } = dependencies({ allQuotes: [pendingQuote, alreadyRejected] });
    await call(createQuoteAcceptHandler(deps));

    expect(quoteStatusUpdates).toEqual([{ id: "quote-1", status: "accepted" }]);
  });

  it("records the 8% fee breakdown for a cash payment (laborArs 20000 + materialsArs 5000)", async () => {
    const { deps, payments } = dependencies();
    const response = await call(createQuoteAcceptHandler(deps), { paymentMethod: "cash" });
    const body = await response.json();

    expect(body).toMatchObject({
      paymentMethod: "cash",
      subtotalArs: 25000,
      feeArs: 2000,
      amountArs: 27000,
    });
    expect(payments).toEqual([
      {
        id: "request-1",
        input: {
          acceptedQuoteId: "quote-1",
          paymentMethod: "cash",
          subtotalArs: 25000,
          feeArs: 2000,
          amountArs: 27000,
        },
      },
    ]);
  });

  it("records a transfer payment the same way, leaving payoutStatus to the repository", async () => {
    const { deps, payments } = dependencies();
    const response = await call(createQuoteAcceptHandler(deps), { paymentMethod: "transfer" });

    expect(response.status).toBe(200);
    expect(payments[0]?.input).toMatchObject({ paymentMethod: "transfer" });
  });
});
