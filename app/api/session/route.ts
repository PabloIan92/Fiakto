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
  ensureDefaultRole: async (uid: string, requestedRole) => {
    // decoded.role puede faltar porque el idToken es viejo (previo a que se
    // asignara el rol), no porque el usuario no tenga uno todavia: el
    // AuthProvider dispara su propio sync en paralelo al del formulario de
    // signup, y esa llamada puede llegar tarde con un token stale. Sin este
    // chequeo, esa llamada tardía pisa "professional" con "customer" por
    // defecto. Se consulta el estado real en Firebase Admin antes de asignar.
    const user = await getAuth().getUser(uid);
    if (user.customClaims?.role) return;
    await getAuth().setCustomUserClaims(uid, { role: requestedRole ?? "customer" });
  },
});

export const DELETE = createSessionDeleteHandler();
