import AdminPaymentsPage from "./client";

// Ver el mismo comentario en app/perfil/page.tsx: esta ruta depende de la
// sesión, así que no puede quedar estática/cacheada por el CDN.
export const dynamic = "force-dynamic";

export default function Page() {
  return <AdminPaymentsPage />;
}
