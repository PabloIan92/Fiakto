"use client";

import { useEffect } from "react";

// next-pwa quedo deshabilitado (ver next.config.ts), pero cualquiera que
// haya visitado el sitio antes de ese cambio todavia tiene un service
// worker viejo activo en su navegador, con un precache que apunta a chunks
// de un build anterior que ya no existen (404 -> bad-precaching-response,
// que puede tumbar la carga de la pagina). Se desregistra en cada visita
// hasta que se reactive el PWA de forma deliberada.
export function ServiceWorkerCleanup() {
  useEffect(() => {
    if (process.env.NEXT_PUBLIC_ENABLE_PWA === "true") return;
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.getRegistrations().then((registrations) => {
      registrations.forEach((registration) => registration.unregister());
    });

    if ("caches" in window) {
      caches.keys().then((keys) => keys.forEach((key) => caches.delete(key)));
    }
  }, []);

  return null;
}
