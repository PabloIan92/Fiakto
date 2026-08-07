import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { createRequestsPostHandler } from "@/app/api/requests/handler";

export const POST = createRequestsPostHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  appendAudit: appendAuditEvent,
});
