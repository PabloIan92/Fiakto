import type { UserProfile } from "@/src/domain/profile";

export interface ProfileRepository {
  get(userId: string): Promise<UserProfile | null>;
  upsert(profile: UserProfile): Promise<void>;
}
