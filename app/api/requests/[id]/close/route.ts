import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { createRequestCloseHandler } from "@/app/api/requests/[id]/close/handler";

export const POST = createRequestCloseHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  appendAudit: appendAuditEvent,
});
