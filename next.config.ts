import path from "path";
import type { NextConfig } from "next";
import withPWA from "next-pwa";

// Next infiere la raíz del workspace subiendo directorios hasta encontrar un
// lockfile, y encuentra uno ajeno en C:\WINDOWS\system32\package-lock.json
// (de otro proyecto, no de Fiakto). Sin esto, Next traza archivos desde esa
// raíz equivocada y el build de las páginas de error (_error/_global-error)
// termina cargando módulos duplicados con distinto casing de ruta.
const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
};

// next-pwa 5.6.0 sigue apoyándose en un wrapper de webpack que, con Next 15 + App Router,
// puede dejar el build en un estado inconsistente durante el prerender. Lo dejamos opt-in
// para no bloquear `next build`; activarlo exige `NEXT_PUBLIC_ENABLE_PWA=true`.
const enablePWA = process.env.NEXT_PUBLIC_ENABLE_PWA === "true";

export default withPWA({
  dest: "public",
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === "development" || !enablePWA,
})(nextConfig);
