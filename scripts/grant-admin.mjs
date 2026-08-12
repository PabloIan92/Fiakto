// Otorga el rol "admin" a una cuenta existente por email, para poder
// entrar a /admin/reportes y /admin/pagos.
//
// Requiere credenciales reales del proyecto (Application Default
// Credentials o GOOGLE_APPLICATION_CREDENTIALS) — no corre en esta máquina
// tal como está configurada hoy (ver README, sección de credenciales
// locales). Corré primero, en una terminal interactiva:
//   gcloud auth application-default login
// y después:
//   node scripts/grant-admin.mjs pabloianlaurino@gmail.com
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const email = process.argv[2];
if (!email) {
  console.error("Uso: node scripts/grant-admin.mjs <email>");
  process.exit(1);
}

const app = getApps()[0] ?? initializeApp();
const auth = getAuth(app);

const user = await auth.getUserByEmail(email);
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, role: "admin" });
console.log(`Listo: ${email} (uid ${user.uid}) ahora tiene role="admin".`);
console.log("Tiene que cerrar sesión y volver a entrar en /login para que tome efecto.");
