import type { ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";

export interface RequestRepository {
  create(input: ServiceRequest): Promise<{ id: string }>;
  saveTriage(id: string, result: TriageResult): Promise<void>;
}
