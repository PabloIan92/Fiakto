import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "settlePayout">;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

export function createAdminPaymentSettlePostHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "admin") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    await dependencies.repository.settlePayout(id);
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "admin",
      action: "payout.settled",
      entityType: "request",
      entityId: id,
      metadata: {},
    });

    return Response.json({ status: "settled" });
  };
}
