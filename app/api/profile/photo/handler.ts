import type { Actor } from "@/src/server/auth";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<ProfileRepository, "setPhotoPath">;
  upload(userId: string, buffer: Buffer, contentType: string): Promise<string>;
  sign(storagePath: string): Promise<string>;
};

export function createProfilePhotoPostHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "professional") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { photoBase64, contentType } = (body as { photoBase64?: unknown; contentType?: unknown }) ?? {};
    if (typeof photoBase64 !== "string" || typeof contentType !== "string") {
      return Response.json({ error: "Missing photoBase64 or contentType" }, { status: 400 });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(photoBase64, "base64");
    } catch {
      return Response.json({ error: "Invalid base64" }, { status: 400 });
    }

    let storagePath: string;
    try {
      storagePath = await dependencies.upload(actor.id, buffer, contentType);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Upload failed" },
        { status: 400 },
      );
    }

    await dependencies.repository.setPhotoPath(actor.id, storagePath);
    const photoUrl = await dependencies.sign(storagePath);
    return Response.json({ photoUrl });
  };
}
