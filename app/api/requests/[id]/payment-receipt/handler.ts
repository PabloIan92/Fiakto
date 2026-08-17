import type { Actor } from "@/src/server/auth";
import { appendAuditEvent } from "@/src/server/audit";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { ReceiptProvider } from "@/src/server/ai/receipt-provider";

type AuditEvent = Parameters<typeof appendAuditEvent>[0];
type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "get" | "submitPaymentReceipt">;
  upload(requestId: string, buffer: Buffer, contentType: string): Promise<string>;
  appendAudit(event: AuditEvent): Promise<unknown>;
  receiptProvider: ReceiptProvider;
  paymentAlias(): string;
  paymentCbu(): string;
  now(): Date;
};

export function createPaymentReceiptPostHandler(dependencies: Dependencies) {
  return async function POST(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "customer") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await context.params;
    const found = await dependencies.repository.get(id);
    if (!found || found.customerId !== actor.id) {
      return Response.json({ error: "Not found" }, { status: 404 });
    }
    if (!found.payoutStatus) {
      return Response.json(
        { error: "This request does not require a payment receipt" },
        { status: 400 },
      );
    }
    if (found.paymentReceipt) {
      return Response.json({ error: "Payment receipt already submitted" }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const { photoBase64, contentType } = (body as { photoBase64?: unknown; contentType?: unknown }) ?? {};
    if (typeof photoBase64 !== "string" || typeof contentType !== "string") {
      return Response.json({ error: "Missing photoBase64 or contentType" }, { status: 400 });
    }

    let buffer: Buffer;
    try {
      buffer = Buffer.from(photoBase64, "base64");
    } catch {
      return Response.json({ error: "Invalid base64" }, { status: 400 });
    }

    let storagePath: string;
    try {
      storagePath = await dependencies.upload(id, buffer, contentType);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Upload failed" },
        { status: 400 },
      );
    }

    // La revision de Gemini es solo informativa: si falla o el resultado no
    // valida, no bloquea que el comprobante quede subido — solo queda
    // marcado para que un admin lo revise a mano en /admin/pagos.
    let verdict: { looksValid: boolean; reason: string } | undefined;
    let reviewedAt: string | undefined;
    try {
      verdict = await dependencies.receiptProvider.verify({
        photoBase64,
        contentType,
        expectedAmountArs: found.payment?.amountArs ?? 0,
        expectedAlias: dependencies.paymentAlias(),
        expectedCbu: dependencies.paymentCbu(),
      });
      reviewedAt = dependencies.now().toISOString();
    } catch {
      verdict = undefined;
    }

    await dependencies.repository.submitPaymentReceipt(id, {
      storagePath,
      mimeType: contentType,
      verdict,
      reviewedAt,
    });
    await dependencies.appendAudit({
      actorId: actor.id,
      actorRole: "customer",
      action: "payment_receipt.submitted",
      entityType: "request",
      entityId: id,
      metadata: { storagePath, verdict },
    });

    return Response.json({ status: "submitted", paymentReceiptVerdict: verdict });
  };
}
