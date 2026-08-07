import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { TriageProvider } from "@/src/server/ai/triage-provider";
import type { TriageRequestRepository } from "@/src/server/repositories/firestore-triage-repository";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: TriageRequestRepository;
  signMedia(paths: string[]): Promise<string[]>;
  triageProvider: TriageProvider;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

export function createTriagePostHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "customer") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const serviceRequest = await dependencies.repository.findById(id);
    if (!serviceRequest) {
      return Response.json({ error: "Request not found" }, { status: 404 });
    }
    if (serviceRequest.customerId !== actor.id) {
      return Response.json({ error: "Forbidden" }, { status: 403 });
    }

    const mediaUrls = await dependencies.signMedia(
      serviceRequest.media.map((media) => media.storagePath),
    );
    const triage = await dependencies.triageProvider.triage({
      description: serviceRequest.description,
      mediaUrls,
    });
    const mustStop = triage.riskLevel === "emergency";

    await dependencies.repository.saveTriage(id, triage, { open: !mustStop });
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "customer",
      action: "request.triaged",
      entityType: "request",
      entityId: id,
      metadata: { riskLevel: triage.riskLevel, matchingOpened: !mustStop },
    });

    if (mustStop) {
      return Response.json({
        triage,
        mustStop: true,
        guidance:
          "Alejate del peligro y llamá al servicio de emergencias correspondiente. No intentes reparar el problema.",
      });
    }

    return Response.json({ triage, mustStop: false });
  };
}
