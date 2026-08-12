import { ServiceRequestSchema } from "@/src/domain/requests";
import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type {
  RequestRepository,
  ServiceRequestWithId,
} from "@/src/server/repositories/request-repository";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";
import { canProfessionalViewRequest } from "@/src/domain/quotes";
import { isPaymentConfirmed } from "@/src/domain/requests";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "create">;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

export type GetDependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "listByCustomer" | "listOpen" | "listByProfessional">;
  profileRepository: ProfileRepository;
};

function withoutExactAddress(item: ServiceRequestWithId) {
  const location = { ...item.location };
  delete location.exactAddress;
  return { ...item, location };
}

export function createRequestsPostHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "customer") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = ServiceRequestSchema.safeParse({
      ...(typeof body === "object" && body !== null ? body : {}),
      customerId: actor.id,
    });
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid request", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const created = await dependencies.repository.create(parsed.data);
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "customer",
      action: "request.created",
      entityType: "request",
      entityId: created.id,
    });

    return Response.json({ id: created.id }, { status: 201 });
  };
}

export function createRequestsGetHandler(dependencies: GetDependencies) {
  return async function GET(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (actor.role === "customer") {
      const own = await dependencies.repository.listByCustomer(actor.id);
      return Response.json({ requests: own });
    }

    if (actor.role === "professional") {
      const profile = await dependencies.profileRepository.get(actor.id, "professional");
      // listOpen() devuelve "open" y "quoted": los presupuestos son
      // privados, así que un profesional sigue pudiendo presupuestar una
      // solicitud que ya recibió el presupuesto de otro (ver
      // FirestoreRequestRepository.listOpen).
      const open = await dependencies.repository.listOpen();
      // item.location puede faltar en solicitudes viejas guardadas antes de
      // que el campo fuera obligatorio en el schema (ver mismo comentario en
      // app/profesional/oportunidades/page.tsx) — sin este guard, una sola
      // solicitud legacy sin location tiraba abajo el listado entero con un
      // 500 (`Cannot read properties of undefined (reading 'province')`),
      // dejando a cualquier profesional sin ver ninguna oportunidad.
      const matching = open.filter((item) =>
        item.location &&
        canProfessionalViewRequest(
          {
            trade: item.triage?.trade ?? "",
            province: item.location.province,
            locality: item.location.locality,
          },
          {
            verified: true,
            trades: profile?.trades ?? [],
            coverage: profile?.coverage ?? [],
          },
        ),
      );
      // A diferencia de "matching" (todavía sin aceptar, nunca se revela la
      // dirección), un trabajo propio sí la muestra una vez que el pago
      // está confirmado (ver isPaymentConfirmed).
      const ownJobs = (await dependencies.repository.listByProfessional(actor.id)).map((item) =>
        isPaymentConfirmed(item) ? item : withoutExactAddress(item),
      );
      return Response.json({
        requests: [...matching.map(withoutExactAddress), ...ownJobs],
      });
    }

    return Response.json({ requests: [] });
  };
}
