import { FieldValue } from "firebase-admin/firestore";

import type { ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";
import { db } from "@/src/server/firebase-admin";
import type { RequestRepository } from "@/src/server/repositories/request-repository";

type DocumentData = Record<string, unknown>;

export interface FirestoreWriteClient {
  collection(path: string): {
    add(data: DocumentData): Promise<{ id: string }>;
    doc(id: string): {
      update(data: DocumentData): Promise<unknown>;
    };
  };
}

export class FirestoreRequestRepository implements RequestRepository {
  constructor(private readonly firestore: FirestoreWriteClient = db) {}

  async create(input: ServiceRequest) {
    const document = await this.firestore.collection("requests").add({
      ...input,
      createdAt: FieldValue.serverTimestamp(),
    });

    return { id: document.id };
  }

  async saveTriage(id: string, result: TriageResult) {
    await this.firestore.collection("requests").doc(id).update({
      triage: result,
      status: "open",
      triagedAt: FieldValue.serverTimestamp(),
    });
  }
}
