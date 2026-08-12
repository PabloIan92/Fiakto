import { authenticateRequest } from "@/src/server/auth";
import { createRequestMediaUploadUrls } from "@/src/server/media";
import { createRequestsMediaPostHandler } from "@/app/api/requests/media/handler";

export const POST = createRequestsMediaPostHandler({
  authenticate: authenticateRequest,
  createUploadUrls: createRequestMediaUploadUrls,
});
