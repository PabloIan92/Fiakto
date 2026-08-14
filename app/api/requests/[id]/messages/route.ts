import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { FirestoreMessageRepository } from "@/src/server/repositories/firestore-message-repository";
import { createMessagesGetHandler, createMessagesPostHandler } from "@/app/api/requests/[id]/messages/handler";

export const GET = createMessagesGetHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  messageRepository: new FirestoreMessageRepository(),
});

export const POST = createMessagesPostHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  messageRepository: new FirestoreMessageRepository(),
  appendAudit: appendAuditEvent,
  now: () => new Date(),
});
