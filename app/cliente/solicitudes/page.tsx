import MisSolicitudesPage from "./client";

// El contenido depende 100% de la sesión (auth + datos por usuario), así
// que no puede ser una página estática: sin esto, Next.js la prerenderiza
// una vez en build time (sin ningún usuario real) y el CDN cachea ese HTML
// congelado — con "Cargando..." ya "horneado" adentro — durante hasta un
// año (`s-maxage`), sirviéndoselo a cualquiera que entre por navegación
// directa/F5 en vez de por un link interno de la app. Este export solo lo
// respeta Next.js en un archivo de Server Component: por eso este page.tsx
// es un wrapper delgado y toda la lógica real vive en client.tsx.
export const dynamic = "force-dynamic";

export default function Page() {
  return <MisSolicitudesPage />;
}
