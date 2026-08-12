import type { Report } from "@/src/domain/reports";

export type StoredReport = Report & { id: string };

export interface ReportRepository {
  create(report: Report): Promise<{ id: string }>;
  listAll(): Promise<StoredReport[]>;
  resolve(id: string, note: string): Promise<void>;
}
