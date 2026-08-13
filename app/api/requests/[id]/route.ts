import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { FirestoreProfileRepository } from "@/src/server/repositories/firestore-profile-repository";
import { signRequestMedia } from "@/src/server/media";
import { createRequestGetHandler, createRequestPutHandler } from "@/app/api/requests/[id]/handler";

export const GET = createRequestGetHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  profileRepository: new FirestoreProfileRepository(),
  signMedia: signRequestMedia,
});

export const PUT = createRequestPutHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  appendAudit: appendAuditEvent,
});
