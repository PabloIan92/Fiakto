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

// La cobertura del profesional es texto libre ("San Isidro, Lanús...") sin
// ningún selector que la fuerce a coincidir letra por letra con la
// localidad que tipeó el cliente al crear la solicitud. Sin normalizar,
// una mayúscula, un espacio de más o una tilde de diferencia hacía que la
// oportunidad nunca apareciera para el profesional aunque ambos hayan
// escrito, para cualquier persona, "la misma" localidad.
function normalizeLocality(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}

export function canProfessionalViewRequest(
  request: Opportunity,
  professional: Professional,
) {
  const requestLocality = normalizeLocality(request.locality);
  return (
    professional.verified &&
    professional.trades.includes(request.trade) &&
    professional.coverage.some((locality) => normalizeLocality(locality) === requestLocality)
  );
}
