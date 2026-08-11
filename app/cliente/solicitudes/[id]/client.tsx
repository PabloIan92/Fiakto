"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { AppHeader } from "@/app/components/AppHeader";

// Leaflet toca `window` al importarse: solo puede correr en el cliente.
const ApproximateMap = dynamic(
  () => import("@/app/components/ApproximateMap").then((mod) => mod.ApproximateMap),
  { ssr: false }
);

type RequestDetail = {
  id: string;
  description: string;
  // El cliente es el dueño, así que exactAddress sí viaja acá (a diferencia
  // de lo que ve un profesional) — nunca lo revela nadie más que el dueño.
  location?: { lat: number; lng: number; displayRadiusKm: number; locality: string; province: string };
  status:
    | "draft"
    | "triaging"
    | "open"
    | "quoted"
    | "accepted"
    | "in_progress"
    | "completed"
    | "closed";
};

type Quote = {
  id: string;
  laborArs: number;
  materialsArs: number;
  description: string;
  estimatedHours: number;
  status: "pending" | "accepted" | "rejected";
};

const STATUS_LABELS: Record<RequestDetail["status"], string> = {
  draft: "Borrador",
  triaging: "En análisis",
  open: "Publicada, esperando presupuestos",
  quoted: "Con presupuestos",
  accepted: "Aceptada",
  in_progress: "En reparación",
  completed: "Completada",
  closed: "Cerrada",
};

const QUOTE_STATUS_LABELS: Record<Quote["status"], string> = {
  pending: "Pendiente",
  accepted: "Aceptado",
  rejected: "Rechazado",
};

export default function SolicitudDetallePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { ready } = useRoleGuard("customer", "/profesional/oportunidades");
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not-found">("loading");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch(`/api/requests/${params.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) return setStatus("not-found");
      const data = (await response.json()) as RequestDetail;
      setRequest(data);

      const quotesResponse = await fetch(`/api/requests/${params.id}/quotes`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (quotesResponse.ok) {
        const quotesData = (await quotesResponse.json()) as { quotes: Quote[] };
        setQuotes(quotesData.quotes);
      } else {
        setQuotes([]);
      }
      setStatus("ok");
    })();
    // `ready` en la lista de dependencias: mismo bug ya corregido en las
    // otras páginas con sesión (ver README, fix 2026-08-11) — sin esto, si
    // `user` resuelve antes que `role`, el efecto nunca se reintenta.
  }, [ready, user, params.id, reloadIndex]);

  async function handleAccept(quoteId: string) {
    if (!user) return;
    setAcceptingId(quoteId);
    setAcceptError(null);
    const token = await user.getIdToken();
    const response = await fetch(`/api/requests/${params.id}/quotes/${quoteId}/accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    setAcceptingId(null);
    if (!response.ok) {
      setAcceptError("No pudimos aceptar este presupuesto. Probá de nuevo.");
      return;
    }
    setReloadIndex((n) => n + 1);
  }

  if (!ready || status === "loading") {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p>Cargando…</p>
        </main>
      </>
    );
  }

  if (status === "not-found" || !request) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p>No encontramos esta solicitud.</p>
        </main>
      </>
    );
  }

  return (
    <>
    <AppHeader />
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href="/cliente/solicitudes" className="mb-4 inline-block text-sm underline">
        Volver a mis solicitudes
      </Link>
      <div className="mb-4 flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Detalle de la solicitud</h1>
        <span className="w-fit rounded-full border border-[#181713]/20 px-3 py-1 text-xs font-semibold">
          {STATUS_LABELS[request.status]}
        </span>
      </div>
      <p className="mb-4 text-sm text-[#777166]">
        {request.location
          ? `${request.location.locality}, ${request.location.province}`
          : "Ubicación no disponible"}
      </p>
      <p className="mb-6">{request.description}</p>

      {request.location && (
        <>
          <h2 className="mb-2 text-lg font-semibold">Zona aproximada</h2>
          <ApproximateMap
            center={{ lat: request.location.lat, lng: request.location.lng }}
            radiusKm={request.location.displayRadiusKm}
          />
        </>
      )}

      <div className="mt-8 border-t border-[#181713]/15 pt-6">
        <h2 className="mb-4 text-lg font-semibold">Presupuestos recibidos</h2>

        {acceptError && (
          <p role="alert" className="mb-4 text-sm font-semibold text-[#b52f1c]">
            {acceptError}
          </p>
        )}

        {!quotes || quotes.length === 0 ? (
          <p className="text-[#777166]">Todavía no recibiste presupuestos para esta solicitud.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {quotes.map((quote) => (
              <li key={quote.id} className="rounded-lg border border-[#181713]/10 p-4">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">
                    Total: ${(quote.laborArs + quote.materialsArs).toLocaleString("es-AR")}
                  </span>
                  <span className="w-fit rounded-full border border-[#181713]/20 px-3 py-1 text-xs font-semibold">
                    {QUOTE_STATUS_LABELS[quote.status]}
                  </span>
                </div>
                <p className="mb-1 text-sm text-[#777166]">
                  Mano de obra: ${quote.laborArs.toLocaleString("es-AR")} · Materiales: $
                  {quote.materialsArs.toLocaleString("es-AR")} · {quote.estimatedHours}h estimadas
                </p>
                <p className="mb-3 text-sm">{quote.description}</p>
                {quote.status === "pending" && (
                  <button
                    type="button"
                    onClick={() => handleAccept(quote.id)}
                    disabled={acceptingId === quote.id}
                    className="w-full bg-[#dc4b2f] px-4 py-2 text-sm font-black text-white transition hover:bg-[#bd351f] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {acceptingId === quote.id ? "Aceptando…" : "Aceptar"}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
    </>
  );
}
