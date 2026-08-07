import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { GeminiTriageProvider } from "@/src/server/ai/gemini-triage-provider";
import { signRequestMedia } from "@/src/server/media";
import { FirestoreTriageRepository } from "@/src/server/repositories/firestore-triage-repository";
import { createTriagePostHandler } from "@/app/api/requests/[id]/triage/handler";

export const POST = createTriagePostHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreTriageRepository(),
  signMedia: signRequestMedia,
  triageProvider: {
    triage: (input) => new GeminiTriageProvider().triage(input),
  },
  appendAudit: appendAuditEvent,
});
