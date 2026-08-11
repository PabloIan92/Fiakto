import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import { SLA_HOURS_BY_RISK } from "@/src/domain/requests";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "listByProfessional" | "startWork">;
  appendAudit(event: AuditEvent): Promise<unknown>;
  now(): Date;
};

export function createRequestStartHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "professional") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    // Solo puede iniciar el profesional cuyo presupuesto fue aceptado (ver
    // POST .../quotes/[quoteId]/accept, que setea professionalId al
    // aceptar). Ya no se busca en listOpen(): una vez aceptado, la
    // solicitud sale de ese conjunto, así que se busca entre los trabajos
    // ya asignados a este profesional.
    const ownJobs = await dependencies.repository.listByProfessional(actor.id);
    const found = ownJobs.find((item) => item.id === id);
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });
    if (found.status !== "accepted") {
      return Response.json(
        { error: "Request is not accepted for this professional" },
        { status: 409 },
      );
    }

    const riskLevel = found.triage?.riskLevel ?? "normal";
    const slaHours = SLA_HOURS_BY_RISK[riskLevel];
    const workStartedAt = dependencies.now().toISOString();
    const slaDeadline = new Date(
      dependencies.now().getTime() + slaHours * 60 * 60 * 1000,
    ).toISOString();

    await dependencies.repository.startWork(id, {
      professionalId: actor.id,
      workStartedAt,
      slaDeadline,
      slaHours,
    });
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "professional",
      action: "request.work_started",
      entityType: "request",
      entityId: id,
      metadata: { slaHours, slaDeadline },
    });

    return Response.json({ status: "in_progress", workStartedAt, slaDeadline, slaHours });
  };
}
