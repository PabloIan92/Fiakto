import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreReportRepository } from "@/src/server/repositories/firestore-report-repository";
import { createAdminReportResolvePostHandler } from "@/app/api/admin/reports/[id]/resolve/handler";

export const POST = createAdminReportResolvePostHandler({
  authenticate: authenticateRequest,
  reportRepository: new FirestoreReportRepository(),
  appendAudit: appendAuditEvent,
});
