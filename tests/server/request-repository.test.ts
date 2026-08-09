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

  async completeWork(id: string, input: { workCompletedAt: string }) {
    const stored = this.requests.get(id);
    if (!stored) throw new Error("Request not found");
    this.requests.set(id, { ...stored, request: { ...stored.request, status: "completed", ...input } });
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

  it("marks the request completed", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreRequestRepository(firestore);
    await repository.completeWork("request-7", { workCompletedAt: "2026-08-10T09:00:00.000Z" });

    expect(firestore.updated[0]).toMatchObject({
      collection: "requests",
      id: "request-7",
      data: { status: "completed", workCompletedAt: "2026-08-10T09:00:00.000Z" },
    });
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
