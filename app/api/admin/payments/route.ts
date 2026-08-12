import { authenticateRequest } from "@/src/server/auth";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { signRequestMedia } from "@/src/server/media";
import { createAdminPaymentsGetHandler } from "@/app/api/admin/payments/handler";

export const GET = createAdminPaymentsGetHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  signMedia: signRequestMedia,
});
