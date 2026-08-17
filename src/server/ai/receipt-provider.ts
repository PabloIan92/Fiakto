import type { PaymentReceiptVerdict } from "@/src/domain/requests";

export interface ReceiptProvider {
  verify(input: {
    photoBase64: string;
    contentType: string;
    expectedAmountArs: number;
    // Un comprobante real puede mostrar el alias o el CBU segun el banco/
    // billetera de origen — nunca los dos. Pasar ambos evita falsos
    // negativos cuando el comprobante muestra el CBU en vez del alias.
    expectedAlias: string;
    expectedCbu: string;
  }): Promise<PaymentReceiptVerdict>;
}
