import { z } from "zod";

import { MediaMimeTypeSchema } from "@/src/domain/requests";
import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";

const CompleteBodySchema = z.object({
  storagePath: z.string().min(1),
  mimeType: MediaMimeTypeSchema,
});

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "listByProfessional" | "completeWork">;
  appendAudit(event: AuditEvent): Promise<unknown>;
  now(): Date;
};

export function createRequestCompleteHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "professional") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const ownJobs = await dependencies.repository.listByProfessional(actor.id);
    const found = ownJobs.find((item) => item.id === id);
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });
    if (found.status !== "in_progress") {
      return Response.json({ error: "Request is not in progress" }, { status: 409 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = CompleteBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Missing completion photo", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const workCompletedAt = dependencies.now().toISOString();
    await dependencies.repository.completeWork(id, {
      workCompletedAt,
      completionMedia: parsed.data,
    });
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "professional",
      action: "request.work_completed",
      entityType: "request",
      entityId: id,
      metadata: { storagePath: parsed.data.storagePath },
    });

    return Response.json({ status: "completed", workCompletedAt });
  };
}
