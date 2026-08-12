import { z } from "zod";

import { computeQuoteBreakdown } from "@/src/domain/quotes";
import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { QuoteRepository } from "@/src/server/repositories/quote-repository";

const AcceptQuoteBodySchema = z.object({
  paymentMethod: z.enum(["cash", "transfer"]),
});

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string; quoteId: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get" | "updateStatus" | "recordPayment">;
  quoteRepository: Pick<QuoteRepository, "get" | "listByRequest" | "updateStatus">;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

export function createQuoteAcceptHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "customer") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id, quoteId } = await context.params;
    const found = await dependencies.repository.get(id);
    // No distinguimos "no existe" de "no es tuya": mismo criterio que el
    // resto de los endpoints de solicitudes (GET /api/requests/[id]) para no
    // filtrar si una solicitud existe a alguien que no es su dueño.
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

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = AcceptQuoteBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid payment method", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const allQuotes = await dependencies.quoteRepository.listByRequest(id);
    await Promise.all(
      allQuotes
        .filter((item) => item.id !== quoteId && item.status === "pending")
        .map((item) => dependencies.quoteRepository.updateStatus(item.id, "rejected")),
    );
    await dependencies.quoteRepository.updateStatus(quoteId, "accepted");
    await dependencies.repository.updateStatus(id, {
      status: "accepted",
      professionalId: quote.professionalId,
    });

    const { subtotalArs, feeArs, totalArs } = computeQuoteBreakdown(quote);
    await dependencies.repository.recordPayment(id, {
      acceptedQuoteId: quoteId,
      paymentMethod: parsed.data.paymentMethod,
      subtotalArs,
      feeArs,
      amountArs: totalArs,
    });

    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "customer",
      action: "quote.accepted",
      entityType: "request",
      entityId: id,
      metadata: { quoteId, professionalId: quote.professionalId, paymentMethod: parsed.data.paymentMethod },
    });

    return Response.json({
      status: "accepted",
      professionalId: quote.professionalId,
      paymentMethod: parsed.data.paymentMethod,
      subtotalArs,
      feeArs,
      amountArs: totalArs,
    });
  };
}
