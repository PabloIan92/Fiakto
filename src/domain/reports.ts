import { z } from "zod";

export const ReportSchema = z.object({
  requestId: z.string().min(1),
  reporterId: z.string().min(1),
  reporterRole: z.enum(["customer", "professional"]),
  reason: z.string().trim().min(10).max(500),
  status: z.enum(["open", "resolved"]).default("open"),
});

export type Report = z.infer<typeof ReportSchema>;
