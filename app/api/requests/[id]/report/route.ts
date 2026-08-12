import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { FirestoreReportRepository } from "@/src/server/repositories/firestore-report-repository";
import { sendTelegramAlert } from "@/src/server/telegram";
import { createRequestReportPostHandler } from "@/app/api/requests/[id]/report/handler";

export const POST = createRequestReportPostHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  reportRepository: new FirestoreReportRepository(),
  appendAudit: appendAuditEvent,
  sendAlert: sendTelegramAlert,
});
