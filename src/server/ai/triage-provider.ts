import type { TriageResult } from "@/src/domain/triage";

export interface TriageProvider {
  triage(input: {
    description: string;
    mediaUrls: string[];
  }): Promise<TriageResult>;
}
