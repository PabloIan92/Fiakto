import { FieldValue } from "firebase-admin/firestore";

import type { Quote } from "@/src/domain/quotes";
import { db } from "@/src/server/firebase-admin";
import type {
  QuoteRepository,
  QuoteStatus,
  QuoteWithId,
} from "@/src/server/repositories/quote-repository";

type StoredQuote = Quote & { status: QuoteStatus };

export class FirestoreQuoteRepository implements QuoteRepository {
  async create(input: Quote) {
    const document = await db.collection("quotes").add({
      ...input,
      status: "pending",
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: document.id };
  }

  async get(id: string): Promise<QuoteWithId | null> {
    const snapshot = await db.collection("quotes").doc(id).get();
    return snapshot.exists ? ({ id: snapshot.id, ...(snapshot.data() as StoredQuote) }) : null;
  }

  async listByRequest(requestId: string): Promise<QuoteWithId[]> {
    const snapshot = await db.collection("quotes").where("requestId", "==", requestId).get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as StoredQuote) }));
  }

  async listByProfessional(requestId: string, professionalId: string): Promise<QuoteWithId[]> {
    const snapshot = await db
      .collection("quotes")
      .where("requestId", "==", requestId)
      .where("professionalId", "==", professionalId)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as StoredQuote) }));
  }

  async updateStatus(id: string, status: QuoteStatus): Promise<void> {
    await db.collection("quotes").doc(id).update({ status });
  }
}
