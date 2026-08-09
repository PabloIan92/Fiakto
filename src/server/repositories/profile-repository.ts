import type { UserProfile } from "@/src/domain/profile";

// Cliente y profesional son roles elegidos en cada login, no cuentas
// distintas: la misma cuenta puede tener un perfil de cliente y uno de
// profesional a la vez, guardados por separado (ver
// FirestoreProfileRepository) para que no se pisen entre si.
export interface ProfileRepository {
  get(userId: string, role: "customer" | "professional" | "admin"): Promise<UserProfile | null>;
  upsert(profile: UserProfile): Promise<void>;
  setPhotoPath(userId: string, role: "professional", photoPath: string): Promise<void>;
}
