import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { FirestoreQuoteRepository } from "@/src/server/repositories/firestore-quote-repository";
import { createQuoteAcceptHandler } from "@/app/api/requests/[id]/quotes/[quoteId]/accept/handler";

export const POST = createQuoteAcceptHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  quoteRepository: new FirestoreQuoteRepository(),
  appendAudit: appendAuditEvent,
});
