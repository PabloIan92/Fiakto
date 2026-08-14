import type { Message } from "@/src/domain/messages";
import { db } from "@/src/server/firebase-admin";
import type { MessageRepository, StoredMessage } from "@/src/server/repositories/message-repository";

type DocumentData = Record<string, unknown>;

interface MessageQuery {
  get(): Promise<{ docs: Array<{ id: string; data(): DocumentData }> }>;
}

export interface MessageFirestoreClient {
  collection(path: string): {
    add(data: DocumentData): Promise<{ id: string }>;
    where(field: string, op: "==", value: unknown): MessageQuery;
  };
}

export class FirestoreMessageRepository implements MessageRepository {
  constructor(private readonly firestore: MessageFirestoreClient = db) {}

  async create(message: Message & { createdAt: string }) {
    const document = await this.firestore.collection("messages").add(message);
    return { id: document.id };
  }

  async listByRequest(requestId: string): Promise<StoredMessage[]> {
    // Ordena en memoria en vez de usar orderBy en la query: un where
    // (requestId) + orderBy (createdAt) en campos distintos exige un
    // índice compuesto en Firestore, y el volumen de mensajes por
    // solicitud es chico — no vale la pena la complejidad de crear/
    // mantener el índice para esto.
    const snapshot = await this.firestore.collection("messages").where("requestId", "==", requestId).get();
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...(doc.data() as Message & { createdAt: string }) }))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
}
