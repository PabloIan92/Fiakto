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
  "refrigeracion",
  "otro",
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
  refrigeracion: "Refrigeración",
  otro: "Otro",
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
  // Ruta en Cloud Storage de la foto de rostro del profesional (no una URL:
  // se firma al leer, ver src/server/media.ts).
  photoPath: z.string().trim().min(1).optional(),
  // YYYY-MM-DD. Optional a nivel de schema para no romper la lectura de
  // perfiles guardados antes de este campo — el PUT handler exige que
  // esté presente y que la persona sea mayor de edad antes de guardar
  // (ver MIN_ADULT_AGE_YEARS más abajo).
  birthDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido")
    .optional(),
});

export type UserProfile = z.infer<typeof UserProfileSchema>;
export type ProfileLocation = z.infer<typeof ProfileLocationSchema>;

// Argentina: mayoría de edad a los 18 años (art. 25 Código Civil y Comercial).
export const MIN_ADULT_AGE_YEARS = 18;

export function calculateAge(birthDate: string, now: Date): number {
  const [year, month, day] = birthDate.split("-").map(Number);
  let age = now.getUTCFullYear() - year;
  const birthdayAlreadyHappenedThisYear =
    now.getUTCMonth() + 1 > month ||
    (now.getUTCMonth() + 1 === month && now.getUTCDate() >= day);
  if (!birthdayAlreadyHappenedThisYear) age -= 1;
  return age;
}

export function isAdult(birthDate: string, now: Date): boolean {
  return calculateAge(birthDate, now) >= MIN_ADULT_AGE_YEARS;
}
