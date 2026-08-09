import { getAuth } from "firebase-admin/auth";

import {
  createSessionDeleteHandler,
  createSessionPostHandler,
} from "@/app/api/session/handler";

export const POST = createSessionPostHandler({
  verifyIdToken: async (idToken: string) => {
    const decoded = await getAuth().verifyIdToken(idToken);
    return { uid: decoded.uid, role: decoded.role };
  },
  setActiveRole: async (uid: string, role: "customer" | "professional") => {
    await getAuth().setCustomUserClaims(uid, { role });
  },
});

export const DELETE = createSessionDeleteHandler();
