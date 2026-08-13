import type { Location, ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";

export type ServiceRequestWithId = ServiceRequest & { id: string };

export interface RequestRepository {
  create(input: ServiceRequest): Promise<{ id: string }>;
  // Lookup directo por id, sin pasar por ninguno de los listados filtrados
  // por rol de abajo. Lo necesitan los endpoints de presupuestos (y el
  // fallback del detalle para un profesional que perdió una puja) para leer
  // una solicitud sin depender de que siga siendo "open"/"quoted" o de que
  // ya sea "propia" según professionalId.
  get(id: string): Promise<ServiceRequestWithId | null>;
  saveTriage(id: string, result: TriageResult): Promise<void>;
  listByCustomer(customerId: string): Promise<ServiceRequestWithId[]>;
  listOpen(): Promise<ServiceRequestWithId[]>;
  listByProfessional(professionalId: string): Promise<ServiceRequestWithId[]>;
  startWork(
    id: string,
    input: { professionalId: string; workStartedAt: string; slaDeadline: string; slaHours: number },
  ): Promise<void>;
  completeWork(
    id: string,
    input: {
      workCompletedAt: string;
      completionMedia: { storagePath: string; mimeType: string };
    },
  ): Promise<void>;
  // El cliente revisa la foto de trabajo terminado y aprueba — recién ahí
  // se cierra de verdad. Separado de completeWork porque lo hacen actores
  // distintos (profesional completa con evidencia, cliente cierra).
  closeRequest(id: string): Promise<void>;
  // Transición genérica de estado usada por el flujo de presupuestos:
  // "open" -> "quoted" al recibir el primer presupuesto, y "-> accepted"
  // (con el professionalId ganador) al aceptar uno.
  updateStatus(
    id: string,
    input: { status: ServiceRequest["status"]; professionalId?: string },
  ): Promise<void>;
  // "cash" nunca toca una cuenta de Fiakto (el cliente le paga en mano al
  // profesional), así que no genera payoutStatus; "transfer" sí, ver
  // listPendingPayouts/settlePayout más abajo.
  recordPayment(
    id: string,
    input: {
      acceptedQuoteId: string;
      paymentMethod: "cash" | "transfer";
      subtotalArs: number;
      feeArs: number;
      amountArs: number;
    },
  ): Promise<void>;
  submitPaymentReceipt(
    id: string,
    receipt: { storagePath: string; mimeType: string },
  ): Promise<void>;
  listPendingPayouts(): Promise<ServiceRequestWithId[]>;
  settlePayout(id: string): Promise<void>;
  // Editar una solicitud ya publicada (solo permitido en estados
  // "editables", ver isEditableStatus en src/domain/requests.ts). Si la
  // descripción cambió, el triage anterior ya no es confiable — se borra y
  // vuelve a "triaging" para forzar un nuevo análisis (el cliente dispara
  // POST .../triage inmediatamente después, mismo patrón que crear una
  // solicitud nueva).
  updateDetails(
    id: string,
    input: { description: string; location: Location; resetTriage: boolean },
  ): Promise<void>;
}
