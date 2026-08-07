import { authenticateRequest } from "@/src/server/auth";
import { FirestoreProfileRepository } from "@/src/server/repositories/firestore-profile-repository";
import { createProfileGetHandler, createProfilePutHandler } from "@/app/api/profile/handler";

const dependencies = {
  authenticate: authenticateRequest,
  repository: new FirestoreProfileRepository(),
};

export const GET = createProfileGetHandler(dependencies);
export const PUT = createProfilePutHandler(dependencies);
