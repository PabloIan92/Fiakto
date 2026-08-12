import { z } from "zod";

import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { ReportRepository } from "@/src/server/repositories/report-repository";

const ResolveBodySchema = z.object({
  note: z.string().trim().min(1).max(500),
});

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  reportRepository: Pick<ReportRepository, "resolve">;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

export function createAdminReportResolvePostHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "admin") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = ResolveBodySchema.safeParse(body);
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid resolution", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    await dependencies.reportRepository.resolve(id, parsed.data.note);
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "admin",
      action: "dispute.resolved",
      entityType: "report",
      entityId: id,
      metadata: { note: parsed.data.note },
    });

    return Response.json({ status: "resolved" });
  };
}
