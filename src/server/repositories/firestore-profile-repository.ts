import type { UserProfile } from "@/src/domain/profile";
import { db } from "@/src/server/firebase-admin";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";

function docId(userId: string, role: string) {
  return `${userId}_${role}`;
}

export class FirestoreProfileRepository implements ProfileRepository {
  async get(userId: string, role: "customer" | "professional" | "admin") {
    const snapshot = await db.collection("profiles").doc(docId(userId, role)).get();
    return snapshot.exists ? (snapshot.data() as UserProfile) : null;
  }

  async upsert(profile: UserProfile) {
    await db
      .collection("profiles")
      .doc(docId(profile.userId, profile.role))
      .set(profile, { merge: true });
  }

  async setPhotoPath(userId: string, role: "professional", photoPath: string) {
    await db
      .collection("profiles")
      .doc(docId(userId, role))
      .set({ userId, role, photoPath }, { merge: true });
  }
}
