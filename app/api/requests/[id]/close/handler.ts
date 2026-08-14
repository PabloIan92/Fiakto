import { z } from "zod";

import { ReviewSchema } from "@/src/domain/requests";
import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";

const CloseBodySchema = z.object({ review: ReviewSchema.optional() }).optional();

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get" | "closeRequest">;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

// El cliente revisa la foto de trabajo terminado que subió el profesional
// (completeWork) y aprueba — esto es lo único que efectivamente cierra la
// solicitud. Separado de /complete porque lo hacen actores distintos.
export function createRequestCloseHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "customer") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found || found.customerId !== actor.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (found.status !== "completed") {
      return Response.json({ error: "Request is not completed yet" }, { status: 409 });
    }
    if (!found.completionMedia) {
      return Response.json(
        { error: "The professional has not submitted a completion photo yet" },
        { status: 400 },
      );
    }

    // El body es opcional (cerrar sin calificar sigue siendo válido) — un
    // POST sin body no tiene JSON parseable, así que solo se intenta
    // parsear si efectivamente mandaron algo.
    const rawBody = await request.text();
    let review: { stars: number; comment?: string } | undefined;
    if (rawBody) {
      let parsedJson: unknown;
      try {
        parsedJson = JSON.parse(rawBody);
      } catch {
        return Response.json({ error: "Invalid JSON" }, { status: 400 });
      }
      const parsed = CloseBodySchema.safeParse(parsedJson);
      if (!parsed.success) {
        return Response.json(
          { error: "Invalid review", issues: parsed.error.issues },
          { status: 400 },
        );
      }
      review = parsed.data?.review;
    }

    await dependencies.repository.closeRequest(id, review);
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "customer",
      action: "request.closed",
      entityType: "request",
      entityId: id,
      metadata: { storagePath: found.completionMedia.storagePath, hasReview: Boolean(review) },
    });

    return Response.json({ status: "closed" });
  };
}
