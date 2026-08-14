import { z } from "zod";

import { TriageResultSchema } from "@/src/domain/triage";

export const MediaMimeTypeSchema = z.enum([
  "image/jpeg",
  "image/png",
  "video/mp4",
  "audio/mpeg",
  "audio/mp4",
]);

export const MediaSchema = z.object({
  storagePath: z.string().min(1),
  mimeType: MediaMimeTypeSchema,
});

export const LocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  displayRadiusKm: z.number().positive().max(50).default(3),
  province: z.string().min(2),
  locality: z.string().min(2),
  publicLocation: z.string().max(0).optional(),
  exactAddress: z.string().optional(),
});

export const PaymentSchema = z.object({
  method: z.enum(["cash", "transfer"]),
  subtotalArs: z.number().nonnegative(),
  feeArs: z.number().nonnegative(),
  amountArs: z.number().nonnegative(),
});

// El comprobante de transferencia es siempre una foto/captura de pantalla
// (nunca video/audio como el resto de MediaSchema), y comparte el mismo
// set de tipos permitidos que la foto de perfil (src/server/media.ts) — se
// define separado de MediaSchema para no acoplar este campo al set de
// tipos de los medios de la solicitud.
export const PaymentReceiptSchema = z.object({
  storagePath: z.string().min(1),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

// El cliente califica al profesional al aprobar y cerrar (POST
// /api/requests/[id]/close) — no hay calificación del profesional al
// cliente todavía (bilateral queda para después del MVP).
export const ReviewSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
});

export const ServiceRequestSchema = z.object({
  customerId: z.string().min(1),
  description: z.string().trim().min(20).max(2000),
  location: LocationSchema,
  media: z.array(MediaSchema).max(6),
  status: z
    .enum([
      "draft",
      "triaging",
      "open",
      "quoted",
      "accepted",
      "in_progress",
      "completed",
      "closed",
    ])
    .default("draft"),
  triage: TriageResultSchema.optional(),
  professionalId: z.string().optional(),
  slaHours: z.number().positive().optional(),
  slaDeadline: z.string().datetime().optional(),
  workStartedAt: z.string().datetime().optional(),
  workCompletedAt: z.string().datetime().optional(),
  acceptedQuoteId: z.string().optional(),
  // Solo se completa al aceptar un presupuesto — ver
  // computeQuoteBreakdown/SERVICE_FEE_RATE en src/domain/quotes.ts. "cash"
  // nunca toca una cuenta de Fiakto (el cliente le paga en mano al
  // profesional), así que no genera payoutStatus; "transfer" sí.
  payment: PaymentSchema.optional(),
  payoutStatus: z.enum(["pending", "settled"]).optional(),
  paymentReceipt: PaymentReceiptSchema.optional(),
  // Foto del trabajo terminado que sube el profesional al completar (no el
  // cliente: él no hizo el trabajo, así que no puede ser quien certifica
  // que quedó bien). El cliente la revisa y aprueba con
  // POST /api/requests/[id]/close para recién ahí pasar a "closed".
  completionMedia: MediaSchema.optional(),
  review: ReviewSchema.optional(),
});

export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;
export type Location = z.infer<typeof LocationSchema>;

// "cash" nunca pasa por Fiakto, así que no hay nada que confirmar más que
// el acuerdo en sí (el profesional necesita la dirección para ir a hacer
// el trabajo). "transfer" recién se considera confirmado cuando el cliente
// subió un comprobante — la liquidación al profesional (payoutStatus) es
// un paso posterior de contabilidad de Fiakto, no una condición para que
// el profesional pueda ir a trabajar.
export function isPaymentConfirmed(
  request: Pick<ServiceRequest, "payment" | "paymentReceipt">,
): boolean {
  if (!request.payment) return false;
  return request.payment.method === "cash" || Boolean(request.paymentReceipt);
}

// Una vez aceptado un presupuesto el profesional ya se comprometió en base
// a la descripción/ubicación originales — permitir editarlas después
// invalidaría ese acuerdo. Antes de aceptar, no hay compromiso de nadie
// todavía, así que el cliente puede corregir lo que hizo falta.
export const EDITABLE_STATUSES: ServiceRequest["status"][] = [
  "draft",
  "triaging",
  "open",
  "quoted",
];

export function isEditableStatus(status: ServiceRequest["status"]): boolean {
  return EDITABLE_STATUSES.includes(status);
}

// Ventana de reparación por nivel de riesgo del triage: cuanto más urgente,
// menos tiempo tiene el profesional para completar el trabajo una vez
// iniciado.
export const SLA_HOURS_BY_RISK: Record<
  z.infer<typeof TriageResultSchema>["riskLevel"],
  number
> = {
  emergency: 4,
  urgent: 24,
  normal: 72,
};