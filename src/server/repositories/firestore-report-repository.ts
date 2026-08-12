import { FieldValue } from "firebase-admin/firestore";

import type { Report } from "@/src/domain/reports";
import { db } from "@/src/server/firebase-admin";
import type { ReportRepository, StoredReport } from "@/src/server/repositories/report-repository";

type DocumentData = Record<string, unknown>;

interface ReportQuery {
  get(): Promise<{ docs: Array<{ id: string; data(): DocumentData }> }>;
}

export interface ReportFirestoreClient {
  collection(path: string): {
    add(data: DocumentData): Promise<{ id: string }>;
    doc(id: string): {
      update(data: DocumentData): Promise<unknown>;
    };
    orderBy(field: string, direction: "asc" | "desc"): ReportQuery;
  };
}

export class FirestoreReportRepository implements ReportRepository {
  constructor(private readonly firestore: ReportFirestoreClient = db) {}

  async create(report: Report) {
    const document = await this.firestore.collection("reports").add({
      ...report,
      createdAt: FieldValue.serverTimestamp(),
    });
    return { id: document.id };
  }

  async listAll(): Promise<StoredReport[]> {
    const snapshot = await this.firestore.collection("reports").orderBy("createdAt", "desc").get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as Report) }));
  }

  async resolve(id: string, note: string) {
    await this.firestore.collection("reports").doc(id).update({
      status: "resolved",
      resolutionNote: note,
      resolvedAt: FieldValue.serverTimestamp(),
    });
  }
}
