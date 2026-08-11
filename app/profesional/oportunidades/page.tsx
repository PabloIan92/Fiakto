import OportunidadesPage from "./client";

// Ver el mismo comentario en app/cliente/solicitudes/page.tsx: esta ruta
// depende de la sesión, así que no puede quedar estática/cacheada por el
// CDN. El export solo lo respeta Next.js en un archivo de Server
// Component, por eso este page.tsx es un wrapper delgado.
export const dynamic = "force-dynamic";

export default function Page() {
  return <OportunidadesPage />;
}
