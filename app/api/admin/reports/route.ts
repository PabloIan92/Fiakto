import { authenticateRequest } from "@/src/server/auth";
import { FirestoreReportRepository } from "@/src/server/repositories/firestore-report-repository";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { createAdminReportsGetHandler } from "@/app/api/admin/reports/handler";

export const GET = createAdminReportsGetHandler({
  authenticate: authenticateRequest,
  reportRepository: new FirestoreReportRepository(),
  repository: new FirestoreRequestRepository(),
});
