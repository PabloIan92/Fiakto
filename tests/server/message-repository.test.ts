import { describe, expect, it } from "vitest";

import { FirestoreMessageRepository } from "@/src/server/repositories/firestore-message-repository";

class FakeFirestore {
  readonly added: Array<{ collection: string; data: Record<string, unknown> }> = [];
  private readonly docs: Array<{ id: string; data: Record<string, unknown> }> = [];
  private sequence = 0;

  seed(data: Record<string, unknown>) {
    this.docs.push({ id: `msg-${++this.sequence}`, data });
  }

  collection(name: string) {
    return {
      add: async (data: Record<string, unknown>) => {
        this.added.push({ collection: name, data });
        const id = `msg-${++this.sequence}`;
        this.docs.push({ id, data });
        return { id };
      },
      where: (field: string, _op: "==", value: unknown) => ({
        get: async () => ({
          docs: this.docs
            .filter((doc) => doc.data[field] === value)
            .map((doc) => ({ id: doc.id, data: () => doc.data })),
        }),
      }),
    };
  }
}

describe("FirestoreMessageRepository", () => {
  it("stores a message under the messages collection", async () => {
    const firestore = new FakeFirestore();
    const repository = new FirestoreMessageRepository(firestore);
    const created = await repository.create({
      requestId: "request-1",
      senderId: "customer-1",
      senderRole: "customer",
      text: "Hola",
      createdAt: "2026-08-14T10:00:00.000Z",
    });

    expect(created.id).toBeDefined();
    expect(firestore.added[0]).toMatchObject({
      collection: "messages",
      data: { requestId: "request-1", text: "Hola" },
    });
  });

  it("returns only messages for the given request, sorted oldest first", async () => {
    const firestore = new FakeFirestore();
    firestore.seed({ requestId: "request-1", senderId: "pro-1", senderRole: "professional", text: "segundo", createdAt: "2026-08-14T10:05:00.000Z" });
    firestore.seed({ requestId: "request-2", senderId: "pro-2", senderRole: "professional", text: "otra solicitud", createdAt: "2026-08-14T10:01:00.000Z" });
    firestore.seed({ requestId: "request-1", senderId: "customer-1", senderRole: "customer", text: "primero", createdAt: "2026-08-14T10:00:00.000Z" });

    const repository = new FirestoreMessageRepository(firestore);
    const messages = await repository.listByRequest("request-1");

    expect(messages.map((m) => m.text)).toEqual(["primero", "segundo"]);
  });
});
