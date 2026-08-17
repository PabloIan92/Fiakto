import type { PaymentReceiptVerdict } from "@/src/domain/requests";

export interface ReceiptProvider {
  verify(input: {
    photoBase64: string;
    contentType: string;
    expectedAmountArs: number;
    expectedAlias: string;
  }): Promise<PaymentReceiptVerdict>;
}
