import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { FirestoreProfileRepository } from "@/src/server/repositories/firestore-profile-repository";
import { createRequestStartHandler } from "@/app/api/requests/[id]/start/handler";

export const POST = createRequestStartHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  profileRepository: new FirestoreProfileRepository(),
  appendAudit: appendAuditEvent,
  now: () => new Date(),
});
