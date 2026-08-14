import type { Message } from "@/src/domain/messages";

export type StoredMessage = Message & { id: string; createdAt: string };

export interface MessageRepository {
  // createdAt lo calcula el handler (dependencies.now(), mismo patrón que
  // workCompletedAt/workStartedAt) en vez de FieldValue.serverTimestamp():
  // así la respuesta del POST puede devolver el mensaje ya con fecha, sin
  // tener que leerlo de vuelta.
  create(message: Message & { createdAt: string }): Promise<{ id: string }>;
  listByRequest(requestId: string): Promise<StoredMessage[]>;
}
