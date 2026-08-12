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
});

export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;
export type Location = z.infer<typeof LocationSchema>;

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