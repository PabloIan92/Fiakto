import { FieldValue } from "firebase-admin/firestore";

import type { Location, PaymentReceiptVerdict, ServiceRequest } from "@/src/domain/requests";
import type { TriageResult } from "@/src/domain/triage";
import { db } from "@/src/server/firebase-admin";
import type { RequestRepository } from "@/src/server/repositories/request-repository";

type DocumentData = Record<string, unknown>;

export interface FirestoreWriteClient {
  collection(path: string): {
    add(data: DocumentData): Promise<{ id: string }>;
    doc(id: string): {
      update(data: DocumentData): Promise<unknown>;
      get(): Promise<{ exists: boolean; id: string; data(): DocumentData | undefined }>;
    };
  };
}

type QuerySnapshotDoc = { id: string; data(): DocumentData };
export interface FirestoreReadClient {
  collection(path: string): {
    where(field: string, op: string, value: unknown): {
      get(): Promise<{ docs: QuerySnapshotDoc[] }>;
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

  async get(id: string) {
    const snapshot = await this.firestore.collection("requests").doc(id).get();
    return snapshot.exists ? ({ id: snapshot.id, ...(snapshot.data() as ServiceRequest) }) : null;
  }

  async saveTriage(id: string, result: TriageResult) {
    await this.firestore.collection("requests").doc(id).update({
      triage: result,
      status: "open",
      triagedAt: FieldValue.serverTimestamp(),
    });
  }

  async listByCustomer(customerId: string) {
    const readClient = this.firestore as unknown as FirestoreReadClient;
    const snapshot = await readClient
      .collection("requests")
      .where("customerId", "==", customerId)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ServiceRequest) }));
  }

  async listOpen() {
    const readClient = this.firestore as unknown as FirestoreReadClient;
    // "Abierta para presupuestar" incluye "quoted": los presupuestos son
    // privados, así que varios profesionales pueden competir por la misma
    // solicitud hasta que el cliente acepte uno. Deja de incluirse recién en
    // "accepted" en adelante.
    const snapshot = await readClient
      .collection("requests")
      .where("status", "in", ["open", "quoted"])
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ServiceRequest) }));
  }

  async listByProfessional(professionalId: string) {
    const readClient = this.firestore as unknown as FirestoreReadClient;
    const snapshot = await readClient
      .collection("requests")
      .where("professionalId", "==", professionalId)
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ServiceRequest) }));
  }

  async startWork(
    id: string,
    input: { professionalId: string; workStartedAt: string; slaDeadline: string; slaHours: number },
  ) {
    await this.firestore.collection("requests").doc(id).update({
      status: "in_progress",
      professionalId: input.professionalId,
      workStartedAt: input.workStartedAt,
      slaDeadline: input.slaDeadline,
      slaHours: input.slaHours,
    });
  }

  async completeWork(
    id: string,
    input: {
      workCompletedAt: string;
      completionMedia: { storagePath: string; mimeType: string };
    },
  ) {
    await this.firestore.collection("requests").doc(id).update({
      status: "completed",
      workCompletedAt: input.workCompletedAt,
      completionMedia: input.completionMedia,
    });
  }

  async closeRequest(id: string, review?: { stars: number; comment?: string }) {
    await this.firestore
      .collection("requests")
      .doc(id)
      .update({
        status: "closed",
        closedAt: FieldValue.serverTimestamp(),
        ...(review ? { review } : {}),
      });
  }

  async updateStatus(
    id: string,
    input: { status: ServiceRequest["status"]; professionalId?: string },
  ) {
    await this.firestore.collection("requests").doc(id).update(input);
  }

  async recordPayment(
    id: string,
    input: {
      acceptedQuoteId: string;
      paymentMethod: "cash" | "transfer";
      subtotalArs: number;
      feeArs: number;
      amountArs: number;
    },
  ) {
    await this.firestore
      .collection("requests")
      .doc(id)
      .update({
        acceptedQuoteId: input.acceptedQuoteId,
        payment: {
          method: input.paymentMethod,
          subtotalArs: input.subtotalArs,
          feeArs: input.feeArs,
          amountArs: input.amountArs,
        },
        ...(input.paymentMethod === "transfer" ? { payoutStatus: "pending" as const } : {}),
      });
  }

  async submitPaymentReceipt(
    id: string,
    receipt: {
      storagePath: string;
      mimeType: string;
      verdict?: PaymentReceiptVerdict;
      reviewedAt?: string;
    },
  ) {
    const update: DocumentData = {
      paymentReceipt: { storagePath: receipt.storagePath, mimeType: receipt.mimeType },
      paymentReceiptSubmittedAt: FieldValue.serverTimestamp(),
    };
    if (receipt.verdict !== undefined) update.paymentReceiptVerdict = receipt.verdict;
    if (receipt.reviewedAt !== undefined) update.paymentReceiptReviewedAt = receipt.reviewedAt;
    await this.firestore.collection("requests").doc(id).update(update);
  }

  async listPendingPayouts() {
    const readClient = this.firestore as unknown as FirestoreReadClient;
    const snapshot = await readClient
      .collection("requests")
      .where("payoutStatus", "==", "pending")
      .get();
    return snapshot.docs.map((doc) => ({ id: doc.id, ...(doc.data() as ServiceRequest) }));
  }

  async settlePayout(id: string) {
    await this.firestore.collection("requests").doc(id).update({
      payoutStatus: "settled",
      payoutSettledAt: FieldValue.serverTimestamp(),
    });
  }

  async updateDetails(
    id: string,
    input: { description: string; location: Location; resetTriage: boolean },
  ) {
    await this.firestore
      .collection("requests")
      .doc(id)
      .update({
        description: input.description,
        location: input.location,
        editedAt: FieldValue.serverTimestamp(),
        ...(input.resetTriage
          ? { status: "triaging" as const, triage: FieldValue.delete() }
          : {}),
      });
  }
}
