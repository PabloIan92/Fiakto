import { describe, expect, it } from "vitest";

import type { ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { appendAuditEvent } from "@/src/server/audit";

class FakeRequestRepository implements RequestRepository {
  private sequence = 0;
  readonly requests = new Map<string, { request: ServiceRequest; triage?: TriageResult }>();

  async create(input: ServiceRequest) {
    const id = `request-${++this.sequence}`;
    this.requests.set(id, { request: input });
    return { id };
  }

  async get(id: string) {
    const stored = this.requests.get(id);
    return stored ? { id, ...stored.request } : null;
  }

  async saveTriage(id: string, result: TriageResult) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, { ...stored, triage: result });
  }

  async listByCustomer(customerId: string) {
    return [...this.requests.entries()]
      .filter(([, value]) => value.request.customerId === customerId)
      .map(([id, value]) => ({ id, ...value.request }));
  }

  async listOpen() {
    return [...this.requests.entries()]
      .filter(([, value]) => value.request.status === "open")
      .map(([id, value]) => ({ id, ...value.request }));
  }

  async listByProfessional(professionalId: string) {
    return [...this.requests.entries()]
      .filter(([, value]) => value.request.professionalId === professionalId)
      .map(([id, value]) => ({ id, ...value.request }));
  }

  async startWork(
    id: string,
    input: { professionalId: string; workStartedAt: string; slaDeadline: string; slaHours: number },
  ) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, { ...stored, request: { ...stored.request, status: "in_progress", ...input } });
  }

  async completeWork(
    id: string,
    input: { workCompletedAt: string; completionMedia: { storagePath: string; mimeType: string } },
  ) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, {
      ...stored,
      request: {
        ...stored.request,
        status: "completed",
        workCompletedAt: input.workCompletedAt,
        completionMedia: input.completionMedia as ServiceRequest["completionMedia"],
      },
    });
  }

  async closeRequest(id: string) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, { ...stored, request: { ...stored.request, status: "closed" } });
  }

  async updateStatus(id: string, input: { status: ServiceRequest["status"]; professionalId?: string }) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, { ...stored, request: { ...stored.request, ...input } });
  }

  async recordPayment(
    id: string,
    input: {
      acceptedQuoteId: string;
      paymentMethod: "cash" | "transfer";
      subtotalArs: number;
      feeArs: number;
      amountArs: number;
    },
  ) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, {
      ...stored,
      request: {
        ...stored.request,
        acceptedQuoteId: input.acceptedQuoteId,
        payment: {
          method: input.paymentMethod,
          subtotalArs: input.subtotalArs,
          feeArs: input.feeArs,
          amountArs: input.amountArs,
        },
        ...(input.paymentMethod === "transfer" ? { payoutStatus: "pending" as const } : {}),
      },
    });
  }

  async submitPaymentReceipt(id: string, receipt: { storagePath: string; mimeType: string }) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, {
      ...stored,
      request: { ...stored.request, paymentReceipt: receipt as ServiceRequest["paymentReceipt"] },
    });
  }

  async listPendingPayouts() {
    return [...this.requests.entries()]
      .filter(([, value]) => value.request.payoutStatus === "pending")
      .map(([id, value]) => ({ id, ...value.request }));
  }

  async settlePayout(id: string) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, { ...stored, request: { ...stored.request, payoutStatus: "settled" } });
  }

  async updateDetails(
    id: string,
    input: { description: string; location: ServiceRequest["location"]; resetTriage: boolean },
  ) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, {
      ...stored,
      request: {
        ...stored.request,
        description: input.description,
        location: input.location,
        ...(input.resetTriage ? { status: "triaging" as const, triage: undefined } : {}),
      },
    });
  }
}

const baseRequest: ServiceRequest = {
  customerId: "customer-1",
  description: "La canilla pierde agua debajo de la mesada.",
  location: {
    lat: -34.6,
    lng: -58.4,
    displayRadiusKm: 3,
    province: "Buenos Aires",
    locality: "Lanús",
  },
  media: [],
  status: "draft",
};

const plumbingTriage: TriageResult = {
  trade: "plomeria",
  summary: "Posible pérdida en la conexión de la canilla.",
  questions: ["¿La pérdida continúa con la llave de paso cerrada?"],
  riskLevel: "normal",
  referenceRangeArs: null,
  confidence: 0.8,
};

describe("RequestRepository contract", () => {
  it("saves triage only on the named request", async () => {
    const repository = new FakeRequestRepository();
    const first = await repository.create(baseRequest);
    const second = await repository.create({
      ...baseRequest,
      description: "El termotanque eléctrico dejó de calentar el agua.",
    });
    await repository.saveTriage(first.id, plumbingTriage);

    expect(repository.requests.get(first.id)?.triage).toEqual(plumbingTriage);
    expect(repository.requests.get(second.id)?.triage).toBeUndefined();
  });
});

class FakeFirestore {
  readonly added: Array<{ collection: string; data: Record<string, unknown> }> = [];
  readonly updated: Array<{ collection: string; id: string; data: Record<string, unknown> }> = [];
  private readonly seeded = new Map<string, Record<string, unknown>>();

  seed(id: string, data: Record<string, unknown>) {
    this.seeded.set(id, data);
  }

  collection(name: string) {
    return {
      add: async (data: Record<string, unknown>) => {
        this.added.push({ collection: name, data });
        return { id: `${name}-1` };
      },
      doc: (id: string) => ({
        update: async (data: Record<string, unknown>) => {
          this.updated.push({ collection: name, id, data });
        },
        get: async () => {
          const data = this.seeded.get(id);
          return { exists: data !== undefined, id, data: () => data };
        },
      }),
      where: (field: string, _op: string, value: unknown) => ({
        get: async () => ({
          docs: [...this.seeded.entries()]
            .filter(([, data]) => data[field] === value)
            .map(([id, data]) => ({ id, data: () => data })),
        }),
      }),
    };
  }
}

describe("FirestoreRequestRepository", () => {
  it("creates a request with a server-generated timestamp", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    const created = await repository.create(baseRequest);

    expect(created).toEqual({ id: "requests-1" });
    expect(firestore.added[0]?.collection).toBe("requests");
    expect(firestore.added[0]?.data).toMatchObject(baseRequest);
    expect(firestore.added[0]?.data.createdAt).toBeDefined();
  });

  it("opens only the named request when saving triage", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.saveTriage("request-7", plumbingTriage);

    expect(firestore.updated).toHaveLength(1);
    expect(firestore.updated[0]).toMatchObject({
      collection: "requests",
      id: "request-7",
      data: { triage: plumbingTriage, status: "open" },
    });
    expect(firestore.updated[0]?.data.triagedAt).toBeDefined();
  });

  it("assigns the professional and sets the SLA deadline when starting work", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.startWork("request-7", {
      professionalId: "pro-1",
      workStartedAt: "2026-08-09T12:00:00.000Z",
      slaDeadline: "2026-08-12T12:00:00.000Z",
      slaHours: 72,
    });

    expect(firestore.updated[0]).toMatchObject({
      collection: "requests",
      id: "request-7",
      data: {
        status: "in_progress",
        professionalId: "pro-1",
        workStartedAt: "2026-08-09T12:00:00.000Z",
        slaDeadline: "2026-08-12T12:00:00.000Z",
        slaHours: 72,
      },
    });
  });

  it("marks the request completed with the professional's completion photo", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.completeWork("request-7", {
      workCompletedAt: "2026-08-10T09:00:00.000Z",
      completionMedia: { storagePath: "requests/pro-1/done.jpg", mimeType: "image/jpeg" },
    });

    expect(firestore.updated[0]).toMatchObject({
      collection: "requests",
      id: "request-7",
      data: {
        status: "completed",
        workCompletedAt: "2026-08-10T09:00:00.000Z",
        completionMedia: { storagePath: "requests/pro-1/done.jpg", mimeType: "image/jpeg" },
      },
    });
  });

  it("closes the request once the customer approves the completion photo", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.closeRequest("request-7");

    expect(firestore.updated[0]).toMatchObject({
      collection: "requests",
      id: "request-7",
      data: { status: "closed" },
    });
    expect(firestore.updated[0]?.data.closedAt).toBeDefined();
  });

  it("returns null from get() when the request doesn't exist", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);

    expect(await repository.get("missing")).toBeNull();
  });

  it("returns the request by id from get()", async () => {
    const firestore = new FakeFirestore();
    firestore.seed("request-7", { ...baseRequest, status: "accepted" });
    const repository = new FirestoreRequestRepository(firestore);

    expect(await repository.get("request-7")).toEqual({
      id: "request-7",
      ...baseRequest,
      status: "accepted",
    });
  });

  it("updates the status and professional when accepting a quote", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.updateStatus("request-7", { status: "accepted", professionalId: "pro-1" });

    expect(firestore.updated[0]).toMatchObject({
      collection: "requests",
      id: "request-7",
      data: { status: "accepted", professionalId: "pro-1" },
    });
  });

  it("records a cash payment without a payoutStatus (never touches a Fiakto account)", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.recordPayment("request-7", {
      acceptedQuoteId: "quote-1",
      paymentMethod: "cash",
      subtotalArs: 10000,
      feeArs: 800,
      amountArs: 10800,
    });

    expect(firestore.updated[0]?.data).toMatchObject({
      acceptedQuoteId: "quote-1",
      payment: { method: "cash", subtotalArs: 10000, feeArs: 800, amountArs: 10800 },
    });
    expect(firestore.updated[0]?.data).not.toHaveProperty("payoutStatus");
  });

  it("records a transfer payment with payoutStatus pending", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.recordPayment("request-7", {
      acceptedQuoteId: "quote-1",
      paymentMethod: "transfer",
      subtotalArs: 10000,
      feeArs: 800,
      amountArs: 10800,
    });

    expect(firestore.updated[0]?.data).toMatchObject({ payoutStatus: "pending" });
  });

  it("lists only requests with a pending payout", async () => {
    const firestore = new FakeFirestore();
    firestore.seed("request-7", { ...baseRequest, payoutStatus: "pending" });
    firestore.seed("request-8", { ...baseRequest, payoutStatus: "settled" });
    const repository = new FirestoreRequestRepository(firestore);

    const pending = await repository.listPendingPayouts();
    expect(pending.map((item) => item.id)).toEqual(["request-7"]);
  });

  it("marks a payout as settled", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.settlePayout("request-7");

    expect(firestore.updated[0]).toMatchObject({
      collection: "requests",
      id: "request-7",
      data: { payoutStatus: "settled" },
    });
  });

  it("stores a submitted payment receipt", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.submitPaymentReceipt("request-7", {
      storagePath: "payment-receipts/request-7.jpg",
      mimeType: "image/jpeg",
    });

    expect(firestore.updated[0]?.data).toMatchObject({
      paymentReceipt: { storagePath: "payment-receipts/request-7.jpg", mimeType: "image/jpeg" },
    });
  });

  it("updates description and location without touching status/triage when the description didn't change", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    const newLocation = {
      lat: -32.9,
      lng: -60.6,
      displayRadiusKm: 3,
      province: "Santa Fe",
      locality: "Rosario",
    };
    await repository.updateDetails("request-7", {
      description: baseRequest.description,
      location: newLocation,
      resetTriage: false,
    });

    expect(firestore.updated[0]?.data).toMatchObject({
      description: baseRequest.description,
      location: newLocation,
    });
    expect(firestore.updated[0]?.data).not.toHaveProperty("status");
    expect(firestore.updated[0]?.data).not.toHaveProperty("triage");
  });

  it("resets status to triaging and clears the old triage when the description changed", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.updateDetails("request-7", {
      description: "Una descripción distinta de al menos veinte caracteres.",
      location: baseRequest.location,
      resetTriage: true,
    });

    expect(firestore.updated[0]?.data).toMatchObject({ status: "triaging" });
    expect(firestore.updated[0]?.data.triage).toBeDefined();
  });
});

describe("appendAuditEvent", () => {
  it("appends metadata and a server-generated timestamp", async () => {
    const firestore = new FakeFirestore();
    await appendAuditEvent(
      {
        actorId: "customer-1",
        actorRole: "customer",
        action: "request.created",
        entityType: "request",
        entityId: "request-1",
      },
      firestore,
    );

    expect(firestore.added[0]).toMatchObject({
      collection: "auditEvents",
      data: {
        actorId: "customer-1",
        actorRole: "customer",
        action: "request.created",
        entityType: "request",
        entityId: "request-1",
        metadata: {},
      },
    });
    expect(firestore.added[0]?.data.createdAt).toBeDefined();
  });
});
