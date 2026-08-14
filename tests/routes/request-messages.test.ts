import { describe, expect, it } from "vitest";

import type { ServiceRequestWithId } from "@/src/server/repositories/request-repository";
import type { StoredMessage } from "@/src/server/repositories/message-repository";
import { createMessagesGetHandler, createMessagesPostHandler } from "@/app/api/requests/[id]/messages/handler";

const acceptedRequest: ServiceRequestWithId = {
  id: "request-1",
  customerId: "customer-1",
  professionalId: "pro-1",
  description: "La canilla pierde agua debajo de la mesada de la cocina.",
  location: { lat: -34.6, lng: -58.4, displayRadiusKm: 3, province: "Buenos Aires", locality: "Lanús" },
  media: [],
  status: "accepted",
};

function context() {
  return { params: Promise.resolve({ id: "request-1" }) };
}

describe("GET /api/requests/:id/messages", () => {
  function dependencies(options?: {
    role?: "customer" | "professional" | "admin";
    actorId?: string;
    found?: ServiceRequestWithId | null;
    messages?: StoredMessage[];
  }) {
    return {
      authenticate: async () => ({
        id: options?.actorId ?? "customer-1",
        role: options?.role ?? ("customer" as const),
      }),
      repository: {
        get: async () => (options?.found === undefined ? acceptedRequest : options.found),
      },
      messageRepository: {
        listByRequest: async () => options?.messages ?? [],
      },
    };
  }

  function call(handler: ReturnType<typeof createMessagesGetHandler>) {
    return handler(new Request("http://localhost/api/requests/request-1/messages"), context());
  }

  it("returns 401 without an authenticated actor", async () => {
    const deps = dependencies();
    const response = await call(createMessagesGetHandler({ ...deps, authenticate: async () => null }));
    expect(response.status).toBe(401);
  });

  it("returns 404 when the request doesn't exist", async () => {
    const deps = dependencies({ found: null });
    const response = await call(createMessagesGetHandler(deps));
    expect(response.status).toBe(404);
  });

  it("returns 403 for a customer who doesn't own the request", async () => {
    const deps = dependencies({ actorId: "someone-else" });
    const response = await call(createMessagesGetHandler(deps));
    expect(response.status).toBe(403);
  });

  it("returns 403 for a professional who isn't the one assigned", async () => {
    const deps = dependencies({ role: "professional", actorId: "pro-2" });
    const response = await call(createMessagesGetHandler(deps));
    expect(response.status).toBe(403);
  });

  it("returns 403 before there's a match (request still open/quoted)", async () => {
    const deps = dependencies({ found: { ...acceptedRequest, status: "quoted", professionalId: undefined } });
    const response = await call(createMessagesGetHandler(deps));
    expect(response.status).toBe(403);
  });

  it("lets the owning customer read the chat", async () => {
    const deps = dependencies({ messages: [{ id: "m1", requestId: "request-1", senderId: "pro-1", senderRole: "professional", text: "Hola", createdAt: "2026-08-14T10:00:00.000Z" }] });
    const response = await call(createMessagesGetHandler(deps));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.messages).toHaveLength(1);
  });

  it("lets an admin read the chat to moderate", async () => {
    const deps = dependencies({ role: "admin", actorId: "admin-1" });
    const response = await call(createMessagesGetHandler(deps));
    expect(response.status).toBe(200);
  });
});

describe("POST /api/requests/:id/messages", () => {
  function dependencies(options?: {
    role?: "customer" | "professional";
    actorId?: string;
    found?: ServiceRequestWithId | null;
  }) {
    const created: Array<Record<string, unknown>> = [];
    const audits: Array<Record<string, unknown>> = [];
    return {
      created,
      audits,
      deps: {
        authenticate: async () => ({
          id: options?.actorId ?? "customer-1",
          role: options?.role ?? ("customer" as const),
        }),
        repository: {
          get: async () => (options?.found === undefined ? acceptedRequest : options.found),
        },
        messageRepository: {
          create: async (message: Record<string, unknown>) => {
            created.push(message);
            return { id: "msg-1" };
          },
        },
        appendAudit: async (event: Record<string, unknown>) => {
          audits.push(event);
        },
        now: () => new Date("2026-08-14T12:00:00.000Z"),
      },
    };
  }

  function call(handler: ReturnType<typeof createMessagesPostHandler>, body: unknown) {
    return handler(
      new Request("http://localhost/api/requests/request-1/messages", {
        method: "POST",
        body: JSON.stringify(body),
      }),
      context(),
    );
  }

  it("returns 401 for an admin (can read, but not post as customer/professional)", async () => {
    const { deps } = dependencies({ role: "customer" });
    const response = await call(
      createMessagesPostHandler({ ...deps, authenticate: async () => ({ id: "admin-1", role: "admin" }) }),
      { text: "hola" },
    );
    expect(response.status).toBe(401);
  });

  it("returns 403 before there's a match", async () => {
    const { deps } = dependencies({ found: { ...acceptedRequest, status: "open", professionalId: undefined } });
    const response = await call(createMessagesPostHandler(deps), { text: "hola" });
    expect(response.status).toBe(403);
  });

  it("returns 400 for an empty message", async () => {
    const { deps } = dependencies();
    const response = await call(createMessagesPostHandler(deps), { text: "" });
    expect(response.status).toBe(400);
  });

  it("stores the message, redacts contact info, and appends an audit event", async () => {
    const { deps, created, audits } = dependencies();
    const response = await call(createMessagesPostHandler(deps), {
      text: "Mi whatsapp es 1155555555, pero hablemos por aquí.",
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.redacted).toBe(true);
    expect(body.message.text).toBe("Mi whatsapp es [contacto oculto], pero hablemos por aquí.");
    expect(created[0]).toMatchObject({
      requestId: "request-1",
      senderId: "customer-1",
      senderRole: "customer",
      text: "Mi whatsapp es [contacto oculto], pero hablemos por aquí.",
      createdAt: "2026-08-14T12:00:00.000Z",
    });
    expect(audits[0]).toMatchObject({ action: "message.sent", metadata: { redacted: true } });
  });

  it("lets the assigned professional send a message too", async () => {
    const { deps, created } = dependencies({ role: "professional", actorId: "pro-1" });
    const response = await call(createMessagesPostHandler(deps), { text: "Puedo pasar mañana." });
    expect(response.status).toBe(200);
    expect(created[0]).toMatchObject({ senderId: "pro-1", senderRole: "professional" });
  });
});
