import type { Quote } from "@/src/domain/quotes";

export type QuoteStatus = "pending" | "accepted" | "rejected";
export type QuoteWithId = Quote & { id: string; status: QuoteStatus };

// Presupuestos son privados: cada profesional que matchea oficio/cobertura
// puede enviar el suyo para una misma solicitud, y el cliente elige uno.
// listByProfessional también sirve como chequeo de duplicados antes de
// crear (ver POST /api/requests/[id]/quotes).
export interface QuoteRepository {
  create(input: Quote): Promise<{ id: string }>;
  get(id: string): Promise<QuoteWithId | null>;
  listByRequest(requestId: string): Promise<QuoteWithId[]>;
  listByProfessional(requestId: string, professionalId: string): Promise<QuoteWithId[]>;
  updateStatus(id: string, status: QuoteStatus): Promise<void>;
}
