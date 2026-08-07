import type { UserProfile } from "@/src/domain/profile";
import { db } from "@/src/server/firebase-admin";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";

export class FirestoreProfileRepository implements ProfileRepository {
  async get(userId: string) {
    const snapshot = await db.collection("profiles").doc(userId).get();
    return snapshot.exists ? (snapshot.data() as UserProfile) : null;
  }

  async upsert(profile: UserProfile) {
    await db.collection("profiles").doc(profile.userId).set(profile, { merge: true });
  }
}
