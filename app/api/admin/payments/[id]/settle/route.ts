import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { createAdminPaymentSettlePostHandler } from "@/app/api/admin/payments/[id]/settle/handler";

export const POST = createAdminPaymentSettlePostHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  appendAudit: appendAuditEvent,
});
