import { z } from "zod";

export const TRADES = [
  "plomeria",
  "electricidad",
  "gasista",
  "cerrajeria",
  "pintura",
  "carpinteria",
  "jardineria",
  "limpieza",
  "albanileria",
  "techista",
] as const;

export const TRADE_LABELS: Record<(typeof TRADES)[number], string> = {
  plomeria: "Plomería",
  electricidad: "Electricidad",
  gasista: "Gasista",
  cerrajeria: "Cerrajería",
  pintura: "Pintura",
  carpinteria: "Carpintería",
  jardineria: "Jardinería",
  limpieza: "Limpieza",
  albanileria: "Albañilería",
  techista: "Techista",
};

export const TradeSchema = z.enum(TRADES);

export const ProfileLocationSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  province: z.string().trim().min(2),
  locality: z.string().trim().min(2),
  exactAddress: z.string().trim().min(3).max(200),
});

export const UserProfileSchema = z.object({
  userId: z.string().min(1),
  role: z.enum(["customer", "professional", "admin"]),
  phone: z.string().trim().min(6).max(20),
  location: ProfileLocationSchema.optional(),
  trades: z.array(TradeSchema).max(TRADES.length).default([]),
  coverage: z.array(z.string().trim().min(2)).max(50).default([]),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type ProfileLocation = z.infer<typeof ProfileLocationSchema>;
