import { FieldValue } from "firebase-admin/firestore";

import { db } from "@/src/server/firebase-admin";
import type { FirestoreWriteClient } from "@/src/server/repositories/firestore-request-repository";

export async function appendAuditEvent(
  input: {
    actorId: string;
    actorRole: "customer" | "professional" | "admin" | "agent";
    action: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
  },
  firestore: FirestoreWriteClient = db,
) {
  await firestore.collection("auditEvents").add({
    ...input,
    metadata: input.metadata ?? {},
    createdAt: FieldValue.serverTimestamp(),
  });
}
