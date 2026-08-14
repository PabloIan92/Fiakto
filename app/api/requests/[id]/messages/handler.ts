import { z } from "zod";

import { redactContactInfo } from "@/src/domain/messages";
import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { MessageRepository } from "@/src/server/repositories/message-repository";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

// El chat solo existe una vez que hay un match real (presupuesto
// aceptado): antes de eso no hay ningún profesional específico con quien
// hablar, y el cliente sigue pudiendo recibir presupuestos de varios.
const CHAT_ENABLED_STATUSES = ["accepted", "in_progress", "completed", "closed"];

function canAccessChat(
  actor: Actor,
  found: { customerId: string; professionalId?: string; status: string },
) {
  if (actor.role === "admin") return true;
  if (!CHAT_ENABLED_STATUSES.includes(found.status)) return false;
  if (actor.role === "customer") return found.customerId === actor.id;
  if (actor.role === "professional") return found.professionalId === actor.id;
  return false;
}

export type GetDependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get">;
  messageRepository: Pick<MessageRepository, "listByRequest">;
};

export function createMessagesGetHandler(dependencies: GetDependencies) {
  return async function GET(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });
    if (!canAccessChat(actor, found)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const messages = await dependencies.messageRepository.listByRequest(id);
    return Response.json({ messages });
  };
}

const SendMessageBodySchema = z.object({
  text: z.string().trim().min(1).max(2000),
});

export type PostDependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get">;
  messageRepository: Pick<MessageRepository, "create">;
  appendAudit(event: AuditEvent): Promise<unknown>;
  now(): Date;
};

export function createMessagesPostHandler(dependencies: PostDependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    // Un admin puede leer para moderar, pero no manda mensajes haciéndose
    // pasar por cliente/profesional.
    if (!actor || (actor.role !== "customer" && actor.role !== "professional")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });
    if (!canAccessChat(actor, found)) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = SendMessageBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid message", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const { text, redacted } = redactContactInfo(parsed.data.text);
    const createdAt = dependencies.now().toISOString();
    const created = await dependencies.messageRepository.create({
      requestId: id,
      senderId: actor.id,
      senderRole: actor.role,
      text,
      createdAt,
    });

    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "message.sent",
      entityType: "request",
      entityId: id,
      metadata: { messageId: created.id, redacted },
    });

    return Response.json({
      message: { id: created.id, requestId: id, senderId: actor.id, senderRole: actor.role, text, createdAt },
      redacted,
    });
  };
}
