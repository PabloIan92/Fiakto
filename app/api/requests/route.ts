import { ServiceRequestSchema } from "@/src/domain/requests";
import type { Actor } from "@/src/server/auth";
import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import type { RequestRepository } from "@/src/server/repositories/request-repository";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];

type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: RequestRepository;
  appendAudit(event: AuditEvent): Promise<unknown>;
};

function createRequestsPostHandler(dependencies: Dependencies) {
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

export const POST = createRequestsPostHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  appendAudit: appendAuditEvent,
});