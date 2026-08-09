import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";
import { canProfessionalViewRequest } from "@/src/domain/quotes";
import { SLA_HOURS_BY_RISK } from "@/src/domain/requests";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "listOpen" | "startWork">;
  profileRepository: ProfileRepository;
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
    const open = await dependencies.repository.listOpen();
    const found = open.find((item) => item.id === id);
    if (!found) return Response.json({ error: "Not found" }, { status: 404 });

    const profile = await dependencies.profileRepository.get(actor.id, "professional");
    const canView = canProfessionalViewRequest(
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
