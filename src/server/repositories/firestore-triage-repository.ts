import { FieldValue } from "firebase-admin/firestore";

import type { ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";
import { db } from "@/src/server/firebase-admin";

export interface TriageRequestRepository {
  findById(id: string): Promise<ServiceRequest | null>;
  saveTriage(
    id: string,
    result: TriageResult,
    options: { open: boolean },
  ): Promise<void>;
}

export class FirestoreTriageRepository implements TriageRequestRepository {
  async findById(id: string) {
    const snapshot = await db.collection("requests").doc(id).get();
    return snapshot.exists ? (snapshot.data() as ServiceRequest) : null;
  }

  async saveTriage(id: string, result: TriageResult, options: { open: boolean }) {
    await db.collection("requests").doc(id).update({
      triage: result,
      status: options.open ? "open" : "triaging",
      triagedAt: FieldValue.serverTimestamp(),
    });
  }
}
