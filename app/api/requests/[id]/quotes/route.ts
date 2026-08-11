import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { FirestoreProfileRepository } from "@/src/server/repositories/firestore-profile-repository";
import { FirestoreQuoteRepository } from "@/src/server/repositories/firestore-quote-repository";
import { createQuotesGetHandler, createQuotesPostHandler } from "@/app/api/requests/[id]/quotes/handler";

const repository = new FirestoreRequestRepository();
const profileRepository = new FirestoreProfileRepository();
const quoteRepository = new FirestoreQuoteRepository();

export const POST = createQuotesPostHandler({
  authenticate: authenticateRequest,
  repository,
  profileRepository,
  quoteRepository,
  appendAudit: appendAuditEvent,
});

export const GET = createQuotesGetHandler({
  authenticate: authenticateRequest,
  repository,
  profileRepository,
  quoteRepository,
});
