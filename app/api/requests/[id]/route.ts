import { authenticateRequest } from "@/src/server/auth";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { FirestoreProfileRepository } from "@/src/server/repositories/firestore-profile-repository";
import { createRequestGetHandler } from "@/app/api/requests/[id]/handler";

export const GET = createRequestGetHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  profileRepository: new FirestoreProfileRepository(),
});
