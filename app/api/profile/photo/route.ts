import { authenticateRequest } from "@/src/server/auth";
import { FirestoreProfileRepository } from "@/src/server/repositories/firestore-profile-repository";
import { uploadProfilePhoto, signProfilePhoto } from "@/src/server/media";
import { createProfilePhotoPostHandler } from "@/app/api/profile/photo/handler";

export const POST = createProfilePhotoPostHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreProfileRepository(),
  upload: uploadProfilePhoto,
  sign: signProfilePhoto,
});
