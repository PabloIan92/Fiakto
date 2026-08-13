import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { QuoteRepository } from "@/src/server/repositories/quote-repository";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string; quoteId: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get">;
  quoteRepository: Pick<QuoteRepository, "get" | "updateStatus">;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

// A diferencia de aceptar, rechazar un presupuesto puntual no toca el
// estado de la solicitud ni al resto de los presupuestos: la solicitud
// sigue "open"/"quoted" (otros profesionales pueden seguir presupuestando
// o ya tener el suyo pendiente), solo se descarta este.
export function createQuoteRejectHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "customer") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, quoteId } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found || found.customerId !== actor.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    const quote = await dependencies.quoteRepository.get(quoteId);
    if (!quote || quote.requestId !== id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (quote.status !== "pending") {
      return Response.json({ error: "Quote is not pending" }, { status: 409 });
    }

    await dependencies.quoteRepository.updateStatus(quoteId, "rejected");
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "customer",
      action: "quote.rejected",
      entityType: "request",
      entityId: id,
      metadata: { quoteId, professionalId: quote.professionalId },
    });

    return Response.json({ status: "rejected" });
  };
}
