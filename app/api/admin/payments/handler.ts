import type { Actor } from "@/src/server/auth";
import type { RequestRepository } from "@/src/server/repositories/request-repository";

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "listPendingPayouts">;
  signMedia(paths: string[]): Promise<string[]>;
};

export function createAdminPaymentsGetHandler(dependencies: Dependencies) {
  return async function GET(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor || actor.role !== "admin") {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const requests = await dependencies.repository.listPendingPayouts();

    const payments = await Promise.all(
      requests.map(async (item) => {
        let paymentReceiptUrl: string | undefined;
        if (item.paymentReceipt) {
          try {
            const [url] = await dependencies.signMedia([item.paymentReceipt.storagePath]);
            paymentReceiptUrl = url;
          } catch {
            paymentReceiptUrl = undefined;
          }
        }

        return {
          id: item.id,
          description: item.description,
          province: item.location?.province ?? "",
          locality: item.location?.locality ?? "",
          subtotalArs: item.payment?.subtotalArs ?? 0,
          feeArs: item.payment?.feeArs ?? 0,
          amountArs: item.payment?.amountArs ?? 0,
          hasReceipt: Boolean(item.paymentReceipt),
          ...(paymentReceiptUrl ? { paymentReceiptUrl } : {}),
        };
      }),
    );

    return Response.json({ payments });
  };
}
