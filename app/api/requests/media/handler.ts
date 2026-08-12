import { z } from "zod";

import { MediaMimeTypeSchema } from "@/src/domain/requests";
import type { Actor } from "@/src/server/auth";
import type { RequestMediaUpload } from "@/src/server/media";

const RequestMediaUploadBodySchema = z.object({
  files: z.array(z.object({ mimeType: MediaMimeTypeSchema })).min(1).max(6),
});

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  createUploadUrls(
    customerId: string,
    files: Array<{ mimeType: string }>,
  ): Promise<RequestMediaUpload[]>;
};

export function createRequestsMediaPostHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor || (actor.role !== "customer" && actor.role !== "professional")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = RequestMediaUploadBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid media upload request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const media = await dependencies.createUploadUrls(actor.id, parsed.data.files);
    return Response.json({ media });
  };
}
