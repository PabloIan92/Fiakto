import { z } from "zod";

export const QuoteSchema = z.object({
  requestId: z.string().min(1),
  professionalId: z.string().min(1),
  laborArs: z.number().positive(),
  materialsArs: z.number().nonnegative(),
  description: z.string().min(20).max(1500),
  estimatedHours: z.number().positive().max(240),
});

type Opportunity = {
  trade: string;
  province: string;
  locality: string;
};

type Professional = {
  verified: boolean;
  trades: string[];
  coverage: string[];
};

export function canProfessionalViewRequest(
  request: Opportunity,
  professional: Professional,
) {
  return (
    professional.verified &&
    professional.trades.includes(request.trade) &&
    professional.coverage.includes(request.locality)
  );
}
