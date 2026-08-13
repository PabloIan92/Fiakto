import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import type { UserProfile } from "@/src/domain/profile";
import { createRequestGetHandler } from "@/app/api/requests/[id]/handler";

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

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

describe("GET /api/requests/[id]", () => {
  it("returns 403 for a professional whose trade doesn't match", async () => {
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [openInLanus],
        listByProfessional: async () => [],
        get: async () => null,
      },
      profileRepository: {
        get: async () =>
          ({ userId: "pro-1", role: "professional", phone: "1", trades: ["electricidad"], coverage: ["Lanús"] }) as UserProfile,
        upsert: async () => undefined,
        setPhotoPath: async () => undefined,
      },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    expect(response.status).toBe(403);
  });

  it("hides exactAddress for a professional who can view the request", async () => {
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [openInLanus],
        listByProfessional: async () => [],
        get: async () => null,
      },
      profileRepository: {
        get: async () =>
          ({
            userId: "pro-1",
            role: "professional",
            phone: "1",
            trades: ["plomeria"],
            coverage: ["Lanús"],
            photoPath: "profile-photos/pro-1.jpg",
          }) as UserProfile,
        upsert: async () => undefined,
        setPhotoPath: async () => undefined,
      },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.location).not.toHaveProperty("exactAddress");
  });

  it("returns 403 for a professional with no profile photo, even if trade/coverage match", async () => {
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [openInLanus],
        listByProfessional: async () => [],
        get: async () => null,
      },
      profileRepository: {
        get: async () =>
          ({ userId: "pro-1", role: "professional", phone: "1", trades: ["plomeria"], coverage: ["Lanús"] }) as UserProfile,
        upsert: async () => undefined,
        setPhotoPath: async () => undefined,
      },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    expect(response.status).toBe(403);
  });

  it("lets the assigned professional view their own in-progress job without rechecking trade/coverage", async () => {
    const ownJob = {
      ...openInLanus,
      status: "in_progress" as const,
      professionalId: "pro-1",
      slaDeadline: "2026-08-12T12:00:00.000Z",
    };
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [],
        listByProfessional: async () => [ownJob],
        get: async () => null,
      },
      profileRepository: {
        get: async () =>
          ({ userId: "pro-1", role: "professional", phone: "1", trades: ["electricidad"], coverage: ["Otra"] }) as UserProfile,
        upsert: async () => undefined,
        setPhotoPath: async () => undefined,
      },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("in_progress");
  });

  it("returns the owning customer's own request with the exact address", async () => {
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "customer-1", role: "customer" }),
      repository: {
        listByCustomer: async () => [openInLanus],
        listOpen: async () => [],
        listByProfessional: async () => [],
        get: async () => null,
      },
      profileRepository: { get: async () => null, upsert: async () => undefined, setPhotoPath: async () => undefined },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.location.exactAddress).toBe("Calle Falsa 123");
  });

  it("signs the completion photo for the owning customer to review before closing", async () => {
    const completed = {
      ...openInLanus,
      status: "completed" as const,
      professionalId: "pro-1",
      completionMedia: { storagePath: "requests/pro-1/done.jpg", mimeType: "image/jpeg" as const },
    };
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "customer-1", role: "customer" }),
      repository: {
        listByCustomer: async () => [completed],
        listOpen: async () => [],
        listByProfessional: async () => [],
        get: async () => null,
      },
      profileRepository: { get: async () => null, upsert: async () => undefined, setPhotoPath: async () => undefined },
      signMedia: async (paths: string[]) => paths.map((path) => `https://signed.example/${path}`),
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    const body = await response.json();
    expect(body.completionMediaUrl).toBe("https://signed.example/requests/pro-1/done.jpg");
  });

  it("returns 403 instead of crashing for a legacy request with no location", async () => {
    const legacyWithoutLocation = { ...openInLanus, location: undefined } as unknown as typeof openInLanus;
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [legacyWithoutLocation],
        listByProfessional: async () => [],
        get: async () => null,
      },
      profileRepository: {
        get: async () =>
          ({ userId: "pro-1", role: "professional", phone: "1", trades: ["plomeria"], coverage: ["Lanús"] }) as UserProfile,
        upsert: async () => undefined,
        setPhotoPath: async () => undefined,
      },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    expect(response.status).toBe(403);
  });

  it("returns 404 for a request the customer doesn't own", async () => {
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "someone-else", role: "customer" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [],
        listByProfessional: async () => [],
        get: async () => null,
      },
      profileRepository: { get: async () => null, upsert: async () => undefined, setPhotoPath: async () => undefined },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    expect(response.status).toBe(404);
  });

  it("falls back to a direct lookup so a professional who lost the bid can see it was assigned to someone else", async () => {
    const acceptedForSomeoneElse = {
      ...openInLanus,
      status: "accepted" as const,
      professionalId: "pro-2",
    };
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        // Ya no está en "open"/"quoted" ni es un trabajo propio: solo
        // aparece a través del fallback de get().
        listOpen: async () => [],
        listByProfessional: async () => [],
        get: async () => acceptedForSomeoneElse,
      },
      profileRepository: {
        get: async () =>
          ({
            userId: "pro-1",
            role: "professional",
            phone: "1",
            trades: ["plomeria"],
            coverage: ["Lanús"],
            photoPath: "profile-photos/pro-1.jpg",
          }) as UserProfile,
        upsert: async () => undefined,
        setPhotoPath: async () => undefined,
      },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: "accepted", professionalId: "pro-2" });
  });

  it("hides exactAddress from the assigned professional until the payment is confirmed", async () => {
    const acceptedNotPaid = {
      ...openInLanus,
      status: "accepted" as const,
      professionalId: "pro-1",
      payment: { method: "transfer" as const, subtotalArs: 25000, feeArs: 2000, amountArs: 27000 },
    };
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [],
        listByProfessional: async () => [acceptedNotPaid],
        get: async () => null,
      },
      profileRepository: { get: async () => null, upsert: async () => undefined, setPhotoPath: async () => undefined },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    const body = await response.json();
    expect(body.location).not.toHaveProperty("exactAddress");
  });

  it("reveals exactAddress to the assigned professional once a transfer receipt was submitted", async () => {
    const acceptedAndPaid = {
      ...openInLanus,
      status: "accepted" as const,
      professionalId: "pro-1",
      payment: { method: "transfer" as const, subtotalArs: 25000, feeArs: 2000, amountArs: 27000 },
      paymentReceipt: { storagePath: "payment-receipts/request-1.jpg", mimeType: "image/jpeg" as const },
    };
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [],
        listByProfessional: async () => [acceptedAndPaid],
        get: async () => null,
      },
      profileRepository: { get: async () => null, upsert: async () => undefined, setPhotoPath: async () => undefined },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    const body = await response.json();
    expect(body.location.exactAddress).toBe("Calle Falsa 123");
  });

  it("reveals exactAddress to the assigned professional immediately for a cash payment", async () => {
    const acceptedCash = {
      ...openInLanus,
      status: "accepted" as const,
      professionalId: "pro-1",
      payment: { method: "cash" as const, subtotalArs: 25000, feeArs: 2000, amountArs: 27000 },
    };
    const handler = createRequestGetHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      repository: {
        listByCustomer: async () => [],
        listOpen: async () => [],
        listByProfessional: async () => [acceptedCash],
        get: async () => null,
      },
      profileRepository: { get: async () => null, upsert: async () => undefined, setPhotoPath: async () => undefined },
      signMedia: async () => [],
    });

    const response = await handler(new Request("http://localhost/api/requests/request-1"), context());
    const body = await response.json();
    expect(body.location.exactAddress).toBe("Calle Falsa 123");
  });
});
