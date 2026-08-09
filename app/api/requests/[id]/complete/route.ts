import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { createRequestCompleteHandler } from "@/app/api/requests/[id]/complete/handler";

export const POST = createRequestCompleteHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  appendAudit: appendAuditEvent,
  now: () => new Date(),
});
