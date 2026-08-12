import { z } from "zod";

import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { ReportRepository } from "@/src/server/repositories/report-repository";

const ReportBodySchema = z.object({
  reason: z.string().trim().min(10).max(500),
});

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get">;
  reportRepository: Pick<ReportRepository, "create">;
  appendAudit(event: AuditEvent): Promise<unknown>;
  sendAlert(text: string): Promise<void>;
};

export function createRequestReportPostHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || (actor.role !== "customer" && actor.role !== "professional")) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    // Reportar solo tiene sentido una vez que hay un compromiso real entre
    // las partes (presupuesto aceptado en adelante) — antes de eso no hay
    // ningun trabajo/pago del que disputar.
    if (found.status !== "accepted" && found.status !== "in_progress" &&
        found.status !== "completed" && found.status !== "closed") {
      return Response.json(
        { error: "This request has no accepted engagement to report" },
        { status: 400 },
      );
    }

    if (actor.role === "customer") {
      if (found.customerId !== actor.id) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
    } else {
      if (found.professionalId !== actor.id) {
        return Response.json({ error: "Not found" }, { status: 404 });
      }
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = ReportBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid report", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    const created = await dependencies.reportRepository.create({
      requestId: id,
      reporterId: actor.id,
      reporterRole: actor.role,
      reason: parsed.data.reason,
      status: "open",
    });

    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: actor.role,
      action: "dispute.reported",
      entityType: "request",
      entityId: id,
      metadata: { reporterRole: actor.role, reportId: created.id },
    });

    await dependencies.sendAlert(
      `⚠️ Fiakto: nuevo reporte en la solicitud ${id} (de ${actor.role}). Revisá /admin/reportes.`,
    );

    return Response.json({ status: "reported" });
  };
}
