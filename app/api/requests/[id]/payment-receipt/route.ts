import { authenticateRequest } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import { FirestoreRequestRepository } from "@/src/server/repositories/firestore-request-repository";
import { uploadPaymentReceipt } from "@/src/server/media";
import { GeminiReceiptProvider } from "@/src/server/ai/gemini-receipt-provider";
import { createPaymentReceiptPostHandler } from "@/app/api/requests/[id]/payment-receipt/handler";

export const POST = createPaymentReceiptPostHandler({
  authenticate: authenticateRequest,
  repository: new FirestoreRequestRepository(),
  upload: uploadPaymentReceipt,
  appendAudit: appendAuditEvent,
  receiptProvider: {
    verify: (input) => new GeminiReceiptProvider().verify(input),
  },
  paymentAlias: () => process.env.NEXT_PUBLIC_FIAKTO_PAYMENT_ALIAS ?? "",
  now: () => new Date(),
});
