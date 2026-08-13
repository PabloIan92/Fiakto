import { z } from "zod";

import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";
import { canProfessionalViewRequest } from "@/src/domain/quotes";
import { LocationSchema, isEditableStatus, isPaymentConfirmed } from "@/src/domain/requests";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "listByCustomer" | "listOpen" | "listByProfessional" | "get">;
  profileRepository: ProfileRepository;
  signMedia(paths: string[]): Promise<string[]>;
};

export function createRequestGetHandler(dependencies: Dependencies) {
  return async function GET(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await context.params;

    if (actor.role === "customer") {
      const own = await dependencies.repository.listByCustomer(actor.id);
      const found = own.find((item) => item.id === id);
      if (!found) return Response.json({ error: "Not found" }, { status: 404 });
      if (!found.completionMedia) return Response.json(found);
      const [completionMediaUrl] = await dependencies.signMedia([
        found.completionMedia.storagePath,
      ]);
      return Response.json({ ...found, completionMediaUrl });
    }

    if (actor.role === "professional") {
      const [open, ownJobs] = await Promise.all([
        dependencies.repository.listOpen(),
        dependencies.repository.listByProfessional(actor.id),
      ]);
      let found = [...open, ...ownJobs].find((item) => item.id === id);
      if (!found) {
        // Puede ser una solicitud que este profesional pudo ver mientras
        // estaba open/quoted (matcheaba oficio/cobertura) pero que ya salió
        // de ese conjunto porque el cliente aceptó el presupuesto de otro
        // profesional. Sin este fallback, quien perdió la puja recibía un
        // 404 genérico en vez de poder ver que el trabajo ya fue asignado a
        // otra persona (ver app/profesional/oportunidades/[id]/page.tsx).
        found = (await dependencies.repository.get(id)) ?? undefined;
      }
      if (!found) return Response.json({ error: "Not found" }, { status: 404 });

      // Si ya es el profesional asignado (in_progress/completed) no hace
      // falta re-chequear oficio/cobertura: ya se validaron al iniciar el
      // trabajo y la solicitud puede haber salido de "open" desde entonces.
      if (found.professionalId !== actor.id) {
        // found.location puede faltar en solicitudes legacy (ver mismo
        // comentario en app/api/requests/handler.ts) — sin location no hay
        // forma de haber matcheado nunca, así que se trata como no visible
        // en vez de crashear con un 500 al leer found.location.province.
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
              hasPhoto: Boolean(profile?.photoPath),
              trades: profile?.trades ?? [],
              coverage: profile?.coverage ?? [],
            },
          );
        if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      // El profesional ve la dirección exacta únicamente en su propio
      // trabajo asignado, y solo una vez que el pago está confirmado (ver
      // isPaymentConfirmed): antes de eso, solo la zona aproximada
      // (lat/lng/displayRadiusKm).
      if (found.professionalId === actor.id && isPaymentConfirmed(found)) {
        return Response.json(found);
      }
      const location = { ...found.location };
      delete location.exactAddress;
      return Response.json({ ...found, location });
    }

    return Response.json({ error: "Forbidden" }, { status: 403 });
  };
}

const EditRequestBodySchema = z.object({
  description: z.string().trim().min(20).max(2000),
  location: LocationSchema,
});

export type PutDependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get" | "updateDetails">;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

export function createRequestPutHandler(dependencies: PutDependencies) {
  return async function PUT(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "customer") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found || found.customerId !== actor.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (!isEditableStatus(found.status)) {
      return Response.json(
        { error: "This request can no longer be edited" },
        { status: 400 },
      );
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = EditRequestBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const resetTriage = parsed.data.description !== found.description;
    await dependencies.repository.updateDetails(id, {
      description: parsed.data.description,
      location: parsed.data.location,
      resetTriage,
    });

    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "customer",
      action: "request.edited",
      entityType: "request",
      entityId: id,
      metadata: { resetTriage },
    });

    return Response.json({ status: "ok", resetTriage });
  };
}
