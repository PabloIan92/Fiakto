import { authenticateRequest } from "@/src/server/auth";
import { FirestoreProfileRepository } from "@/src/server/repositories/firestore-profile-repository";
import { signProfilePhoto } from "@/src/server/media";
import { createProfileGetHandler, createProfilePutHandler } from "@/app/api/profile/handler";

const dependencies = {
  authenticate: authenticateRequest,
  repository: new FirestoreProfileRepository(),
  signPhoto: signProfilePhoto,
  now: () => new Date(),
};

export const GET = createProfileGetHandler(dependencies);
export const PUT = createProfilePutHandler(dependencies);
