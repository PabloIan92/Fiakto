import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import type { QuoteWithId } from "@/src/server/repositories/quote-repository";
import type { UserProfile } from "@/src/domain/profile";
import { createQuotesGetHandler, createQuotesPostHandler } from "@/app/api/requests/[id]/quotes/handler";

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

const matchingProfile: UserProfile = {
  userId: "pro-1",
  role: "professional",
  phone: "123456",
  trades: ["plomeria"],
  coverage: ["Lanús"],
};

const validQuoteBody = {
  laborArs: 20000,
  materialsArs: 5000,
  description: "Cambio de la canilla y sellado de la conexión debajo de la mesada.",
  estimatedHours: 2,
};

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

function postRequest(body: unknown = validQuoteBody) {
  return new Request("http://localhost/api/requests/request-1/quotes", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/requests/:id/quotes", () => {
  function dependencies(options?: {
    role?: "customer" | "professional";
    found?: ServiceRequestWithId | null;
    profile?: UserProfile | null;
    existing?: QuoteWithId[];
  }) {
    const created: unknown[] = [];
    const statusUpdates: Array<{ id: string; input: Record<string, unknown> }> = [];
    const audits: Array<Record<string, unknown>> = [];
    return {
      created,
      statusUpdates,
      audits,
      deps: {
        authenticate: async () => ({ id: "pro-1", role: options?.role ?? ("professional" as const) }),
        repository: {
          get: async () => (options?.found === undefined ? openInLanus : options.found),
          updateStatus: async (id: string, input: Record<string, unknown>) => {
            statusUpdates.push({ id, input });
          },
        },
        profileRepository: {
          get: async () => (options?.profile === undefined ? matchingProfile : options.profile),
          upsert: async () => undefined,
          setPhotoPath: async () => undefined,
        },
        quoteRepository: {
          create: async (input: Record<string, unknown>) => {
            created.push(input);
            return { id: "quote-1" };
          },
          listByProfessional: async () => options?.existing ?? [],
        },
        appendAudit: async (event: Record<string, unknown>) => {
          audits.push(event);
        },
      },
    };
  }

  it("returns 401 when the actor isn't an authenticated professional", async () => {
    const { deps } = dependencies({ role: "customer" });
    const response = await createQuotesPostHandler(deps)(postRequest(), context());
    expect(response.status).toBe(401);
  });

  it("returns 404 when the request doesn't exist", async () => {
    const { deps } = dependencies({ found: null });
    const response = await createQuotesPostHandler(deps)(postRequest(), context());
    expect(response.status).toBe(404);
  });

  it("returns 403 when the professional's trade/coverage doesn't match", async () => {
    const { deps } = dependencies({
      profile: { ...matchingProfile, trades: ["electricidad"] },
    });
    const response = await createQuotesPostHandler(deps)(postRequest(), context());
    expect(response.status).toBe(403);
  });

  it("returns 409 when the request is no longer open/quoted", async () => {
    const { deps } = dependencies({ found: { ...openInLanus, status: "accepted" } });
    const response = await createQuotesPostHandler(deps)(postRequest(), context());
    expect(response.status).toBe(409);
  });

  it("returns 409 when this professional already submitted a quote", async () => {
    const { deps } = dependencies({
      existing: [{ ...validQuoteBody, id: "quote-0", requestId: "request-1", professionalId: "pro-1", status: "pending" }],
    });
    const response = await createQuotesPostHandler(deps)(postRequest(), context());
    expect(response.status).toBe(409);
  });

  it("returns 400 when the body fails QuoteSchema validation", async () => {
    const { deps } = dependencies();
    const response = await createQuotesPostHandler(deps)(
      postRequest({ ...validQuoteBody, description: "muy corta" }),
      context(),
    );
    expect(response.status).toBe(400);
  });

  it("creates the quote, moves the request from open to quoted, and appends an audit event", async () => {
    const { deps, created, statusUpdates, audits } = dependencies();
    const response = await createQuotesPostHandler(deps)(postRequest(), context());

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ id: "quote-1" });
    expect(created[0]).toMatchObject({
      ...validQuoteBody,
      requestId: "request-1",
      professionalId: "pro-1",
    });
    expect(statusUpdates[0]).toMatchObject({ id: "request-1", input: { status: "quoted" } });
    expect(audits[0]).toMatchObject({ action: "quote.submitted", entityId: "request-1" });
  });

  it("doesn't touch the request status when it was already quoted", async () => {
    const { deps, statusUpdates } = dependencies({ found: { ...openInLanus, status: "quoted" } });
    const response = await createQuotesPostHandler(deps)(postRequest(), context());

    expect(response.status).toBe(201);
    expect(statusUpdates).toHaveLength(0);
  });
});

describe("GET /api/requests/:id/quotes", () => {
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

  function dependencies(options?: {
    role?: "customer" | "professional";
    actorId?: string;
    found?: ServiceRequestWithId | null;
    profile?: UserProfile | null;
    quotes?: QuoteWithId[];
    ownQuote?: QuoteWithId[];
  }) {
    return {
      authenticate: async () => ({
        id: options?.actorId ?? "customer-1",
        role: options?.role ?? ("customer" as const),
      }),
      repository: {
        get: async () => (options?.found === undefined ? openInLanus : options.found),
      },
      profileRepository: {
        get: async () => (options?.profile === undefined ? matchingProfile : options.profile),
        upsert: async () => undefined,
        setPhotoPath: async () => undefined,
      },
      quoteRepository: {
        listByRequest: async () => options?.quotes ?? [pendingQuote],
        listByProfessional: async () => options?.ownQuote ?? [pendingQuote],
      },
    };
  }

  function getRequest() {
    return new Request("http://localhost/api/requests/request-1/quotes");
  }

  it("returns 401 without an authenticated actor", async () => {
    const deps = dependencies();
    const handler = createQuotesGetHandler({ ...deps, authenticate: async () => null });
    const response = await handler(getRequest(), context());
    expect(response.status).toBe(401);
  });

  it("returns 404 when the request doesn't exist", async () => {
    const deps = dependencies({ found: null });
    const response = await createQuotesGetHandler(deps)(getRequest(), context());
    expect(response.status).toBe(404);
  });

  it("returns 403 for a customer who doesn't own the request", async () => {
    const deps = dependencies({ actorId: "someone-else" });
    const response = await createQuotesGetHandler(deps)(getRequest(), context());
    expect(response.status).toBe(403);
  });

  it("returns every quote to the owning customer", async () => {
    const deps = dependencies();
    const response = await createQuotesGetHandler(deps)(getRequest(), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.quotes).toEqual([pendingQuote]);
  });

  it("returns 403 for a professional whose trade/coverage doesn't match", async () => {
    const deps = dependencies({
      role: "professional",
      actorId: "pro-2",
      profile: { ...matchingProfile, userId: "pro-2", trades: ["electricidad"] },
    });
    const response = await createQuotesGetHandler(deps)(getRequest(), context());
    expect(response.status).toBe(403);
  });

  it("returns only the professional's own quote (or null)", async () => {
    const deps = dependencies({ role: "professional", actorId: "pro-1", ownQuote: [] });
    const response = await createQuotesGetHandler(deps)(getRequest(), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.quote).toBeNull();
  });

  it("lets the assigned professional read their quote status without rechecking trade/coverage", async () => {
    const deps = dependencies({
      role: "professional",
      actorId: "pro-1",
      found: { ...openInLanus, status: "accepted", professionalId: "pro-1" },
      profile: { ...matchingProfile, trades: ["electricidad"] },
    });
    const response = await createQuotesGetHandler(deps)(getRequest(), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.quote).toMatchObject({ id: "quote-1" });
  });
});
