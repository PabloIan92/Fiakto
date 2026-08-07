import type { ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";

export type ServiceRequestWithId = ServiceRequest & { id: string };

export interface RequestRepository {
  create(input: ServiceRequest): Promise<{ id: string }>;
  saveTriage(id: string, result: TriageResult): Promise<void>;
  listByCustomer(customerId: string): Promise<ServiceRequestWithId[]>;
  listOpen(): Promise<ServiceRequestWithId[]>;
}
