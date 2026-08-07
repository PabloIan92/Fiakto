import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { FirestoreProfileRepository } from "@/src/server/repositories/firestore-profile-repository";
import { createRequestsGetHandler, createRequestsPostHandler } from "@/app/api/requests/handler";

const repository = new FirestoreRequestRepository();

export const POST = createRequestsPostHandler({
  authenticate: authenticateRequest,
  repository,
  appendAudit: appendAuditEvent,
});

export const GET = createRequestsGetHandler({
  authenticate: authenticateRequest,
  repository,
  profileRepository: new FirestoreProfileRepository(),
});
