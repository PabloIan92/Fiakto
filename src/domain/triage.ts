import { z } from "zod";

import { TradeSchema } from "@/src/domain/profile";

export const TriageResultSchema = z.object({
  trade: TradeSchema,
  summary: z.string().min(10).max(500),
  questions: z.array(z.string().min(5)).max(5),
  riskLevel: z.enum(["normal", "urgent", "emergency"]),
  referenceRangeArs: z
    .object({
      min: z.number().nonnegative(),
      max: z.number().positive(),
    })
    .nullable(),
  confidence: z.number().min(0).max(1),
});

export type TriageResult = z.infer<typeof TriageResultSchema>;
