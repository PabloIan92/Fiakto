import type { Actor } from "@/src/server/auth";
import type { ReportRepository, StoredReport } from "@/src/server/repositories/report-repository";
import type { RequestRepository } from "@/src/server/repositories/request-repository";

type RequestSummary = {
  description: string;
  province: string;
  locality: string;
  status: string;
} | null;

type EnrichedReport = StoredReport & { request: RequestSummary };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  reportRepository: Pick<ReportRepository, "listAll">;
  repository: Pick<RequestRepository, "get">;
};

export function createAdminReportsGetHandler(dependencies: Dependencies) {
  return async function GET(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "admin") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const reports = await dependencies.reportRepository.listAll();

    const enriched: EnrichedReport[] = await Promise.all(
      reports.map(async (report) => {
        const found = await dependencies.repository.get(report.requestId);
        return {
          ...report,
          request: found
            ? {
                description: found.description,
                province: found.location?.province ?? "",
                locality: found.location?.locality ?? "",
                status: found.status,
              }
            : null,
        };
      }),
    );

    return Response.json({ reports: enriched });
  };
}
