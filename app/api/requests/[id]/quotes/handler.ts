import { QuoteSchema, canProfessionalViewRequest } from "@/src/domain/quotes";
import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";
import type { QuoteRepository } from "@/src/server/repositories/quote-repository";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type PostDependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get" | "updateStatus">;
  profileRepository: ProfileRepository;
  quoteRepository: Pick<QuoteRepository, "create" | "listByProfessional">;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

export type GetDependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get">;
  profileRepository: ProfileRepository;
  quoteRepository: Pick<QuoteRepository, "listByRequest" | "listByProfessional">;
};

export function createQuotesPostHandler(dependencies: PostDependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "professional") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });

    const profile = await dependencies.profileRepository.get(actor.id, "professional");
    // found.location puede faltar en solicitudes legacy (ver mismo
    // comentario en app/api/requests/handler.ts).
    const canView =
      !!found.location &&
      canProfessionalViewRequest(
        {
          trade: found.triage?.trade ?? "",
          province: found.location.province,
          locality: found.location.locality,
        },
        {
          verified: true,
          trades: profile?.trades ?? [],
          coverage: profile?.coverage ?? [],
        },
      );
    if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });

    if (found.status !== "open" && found.status !== "quoted") {
      return Response.json({ error: "Request is not accepting quotes" }, { status: 409 });
    }

    const existing = await dependencies.quoteRepository.listByProfessional(id, actor.id);
    if (existing.length > 0) {
      return Response.json(
        { error: "You already submitted a quote for this request" },
        { status: 409 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = QuoteSchema.safeParse({
      ...(typeof body === "object" && body !== null ? body : {}),
      requestId: id,
      professionalId: actor.id,
    });
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid quote", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const created = await dependencies.quoteRepository.create(parsed.data);

    // Solo la primera vez ("open" -> "quoted") hace falta tocar el status de
    // la solicitud: si ya está "quoted" (otro profesional ya presupuestó
    // antes) no hay transición que hacer.
    if (found.status === "open") {
      await dependencies.repository.updateStatus(id, { status: "quoted" });
    }

    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "professional",
      action: "quote.submitted",
      entityType: "request",
      entityId: id,
      metadata: { quoteId: created.id },
    });

    return Response.json({ id: created.id }, { status: 201 });
  };
}

export function createQuotesGetHandler(dependencies: GetDependencies) {
  return async function GET(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor) return Response.json({ error: "Unauthorized" }, { status: 401 });

    const { id } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });

    if (actor.role === "customer") {
      if (found.customerId !== actor.id) {
        return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      // El cliente ve todos los presupuestos recibidos (pending/accepted/
      // rejected) con sus montos y descripción, pero el contrato de Quote
      // no incluye datos de contacto del profesional: la revelación de
      // teléfono/email es un ítem separado del roadmap (ver README), no se
      // toca acá.
      const quotes = await dependencies.quoteRepository.listByRequest(id);
      return Response.json({ quotes });
    }

    if (actor.role === "professional") {
      if (found.professionalId !== actor.id) {
        const profile = await dependencies.profileRepository.get(actor.id, "professional");
        const canView =
          !!found.location &&
          canProfessionalViewRequest(
            {
              trade: found.triage?.trade ?? "",
              province: found.location.province,
              locality: found.location.locality,
            },
            {
              verified: true,
              trades: profile?.trades ?? [],
              coverage: profile?.coverage ?? [],
            },
          );
        if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });
      }
      // Solo su propio presupuesto (si lo mandó), no los de la competencia.
      const own = await dependencies.quoteRepository.listByProfessional(id, actor.id);
      return Response.json({ quote: own[0] ?? null });
    }

    return Response.json({ error: "Forbidden" }, { status: 403 });
  };
}
