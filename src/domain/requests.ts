import { z } from "zod";

export const MediaSchema = z.object({
  storagePath: z.string().min(1),
  mimeType: z.enum([
    "image/jpeg",
    "image/png",
    "video/mp4",
    "audio/mpeg",
    "audio/mp4",
  ]),
});

export const ServiceRequestSchema = z.object({
  customerId: z.string().min(1),
  description: z.string().trim().min(20).max(2000),
  province: z.string().min(2),
  locality: z.string().min(2),
  publicLocation: z.string().max(0).optional(),
  media: z.array(MediaSchema).max(6),
  status: z
    .enum(["draft", "triaging", "open", "quoted", "accepted", "closed"])
    .default("draft"),
});

export type ServiceRequest = z.infer<typeof ServiceRequestSchema>;
