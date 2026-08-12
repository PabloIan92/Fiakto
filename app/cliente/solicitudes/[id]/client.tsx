"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import dynamic from "next/dynamic";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { AppHeader } from "@/app/components/AppHeader";
import { computeQuoteBreakdown } from "@/src/domain/quotes";

// Leaflet toca `window` al importarse: solo puede correr en el cliente.
const ApproximateMap = dynamic(
  () => import("@/app/components/ApproximateMap").then((mod) => mod.ApproximateMap),
  { ssr: false }
);

const FIAKTO_PAYMENT_ALIAS = process.env.NEXT_PUBLIC_FIAKTO_PAYMENT_ALIAS ?? "";

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
  payment?: { method: "cash" | "transfer"; subtotalArs: number; feeArs: number; amountArs: number };
  payoutStatus?: "pending" | "settled";
  paymentReceipt?: { storagePath: string; mimeType: string };
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

const REPORTABLE_STATUSES: RequestDetail["status"][] = ["accepted", "in_progress", "completed", "closed"];

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function SolicitudDetallePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { ready } = useRoleGuard("customer", "/profesional/oportunidades");
  const [request, setRequest] = useState<RequestDetail | null>(null);
  const [quotes, setQuotes] = useState<Quote[] | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not-found">("loading");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptError, setAcceptError] = useState<string | null>(null);
  const [receiptError, setReceiptError] = useState("");
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");
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

  async function handleAccept(quoteId: string, paymentMethod: "cash" | "transfer") {
    if (!user) return;
    setAcceptingId(quoteId);
    setAcceptError(null);
    const token = await user.getIdToken();
    const response = await fetch(`/api/requests/${params.id}/quotes/${quoteId}/accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ paymentMethod }),
    });
    setAcceptingId(null);
    if (!response.ok) {
      setAcceptError("No pudimos aceptar este presupuesto. Probá de nuevo.");
      return;
    }
    setReloadIndex((n) => n + 1);
  }

  async function handleReceiptChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setReceiptError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setReceiptError("Usá JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setReceiptError("El comprobante no puede superar los 3 MB.");
      return;
    }

    setUploadingReceipt(true);
    const token = await user.getIdToken();
    const photoBase64 = await readFileAsBase64(file);
    const response = await fetch(`/api/requests/${params.id}/payment-receipt`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ photoBase64, contentType: file.type }),
    });
    setUploadingReceipt(false);
    if (!response.ok) {
      setReceiptError("No pudimos subir el comprobante. Probá de nuevo.");
      return;
    }
    setReloadIndex((n) => n + 1);
  }

  async function handleReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setReportStatus("submitting");
    const token = await user.getIdToken();
    const response = await fetch(`/api/requests/${params.id}/report`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({ reason: reportReason }),
    });
    setReportStatus(response.ok ? "done" : "error");
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

  const needsReceipt =
    request.payment?.method === "transfer" && request.payoutStatus === "pending" && !request.paymentReceipt;

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

      {request.payment && (
        <div className="mt-8 border-t border-[#181713]/15 pt-6">
          <h2 className="mb-2 text-lg font-semibold">Pago</h2>
          <p className="text-sm">
            {request.payment.method === "cash" ? "Efectivo, en mano" : "Transferencia a Fiakto"} · Total: $
            {request.payment.amountArs.toLocaleString("es-AR")} (incluye comisión Fiakto de $
            {request.payment.feeArs.toLocaleString("es-AR")})
          </p>

          {needsReceipt && (
            <div className="mt-4 border border-dashed border-[#181713]/35 bg-[#f3efe6]/60 p-4">
              <p className="mb-2 text-sm font-bold">
                Transferí ${request.payment.amountArs.toLocaleString("es-AR")} al alias{" "}
                <span className="font-mono">{FIAKTO_PAYMENT_ALIAS}</span> y subí el comprobante.
              </p>
              <input
                aria-label="Comprobante de transferencia"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleReceiptChange}
                disabled={uploadingReceipt}
                className="block w-full text-sm file:mr-4 file:border-0 file:bg-[#181713] file:px-4 file:py-2 file:font-bold file:text-white"
              />
              {uploadingReceipt && <p className="mt-2 text-xs">Subiendo…</p>}
              {receiptError && (
                <p role="alert" className="mt-2 text-xs font-bold text-[#b52f1c]">
                  {receiptError}
                </p>
              )}
            </div>
          )}
          {request.payment.method === "transfer" && request.paymentReceipt && (
            <p className="mt-3 text-sm font-semibold text-[#34745a]">Comprobante recibido.</p>
          )}
        </div>
      )}

      {REPORTABLE_STATUSES.includes(request.status) && (
        <div className="mt-8 border-t border-[#181713]/15 pt-6">
          <h2 className="mb-2 text-lg font-semibold">¿Algo salió mal?</h2>
          {reportStatus === "done" ? (
            <p className="text-sm font-semibold text-[#34745a]">
              Reportado. Un admin de Fiakto lo va a revisar.
            </p>
          ) : (
            <form onSubmit={handleReport} className="flex flex-col gap-2">
              <textarea
                aria-label="Contanos qué pasó"
                required
                minLength={10}
                maxLength={500}
                rows={3}
                placeholder="Contanos qué pasó…"
                value={reportReason}
                onChange={(event) => setReportReason(event.target.value)}
                className="w-full resize-y border border-[#181713]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#dc4b2f]"
              />
              <button
                type="submit"
                disabled={reportStatus === "submitting"}
                className="w-fit border border-[#181713]/30 px-4 py-2 text-sm font-bold transition hover:border-[#181713]/60 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {reportStatus === "submitting" ? "Enviando…" : "Reportar un problema"}
              </button>
              {reportStatus === "error" && (
                <p role="alert" className="text-xs font-bold text-[#b52f1c]">
                  No pudimos enviar el reporte. Probá de nuevo.
                </p>
              )}
            </form>
          )}
        </div>
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
            {quotes.map((quote) => {
              const breakdown = computeQuoteBreakdown(quote);
              return (
                <li key={quote.id} className="rounded-lg border border-[#181713]/10 p-4">
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <span className="text-sm font-bold">
                      Total con comisión: ${breakdown.totalArs.toLocaleString("es-AR")}
                    </span>
                    <span className="w-fit rounded-full border border-[#181713]/20 px-3 py-1 text-xs font-semibold">
                      {QUOTE_STATUS_LABELS[quote.status]}
                    </span>
                  </div>
                  <p className="mb-1 text-sm text-[#777166]">
                    Mano de obra: ${quote.laborArs.toLocaleString("es-AR")} · Materiales: $
                    {quote.materialsArs.toLocaleString("es-AR")} · {quote.estimatedHours}h estimadas
                  </p>
                  <p className="mb-1 text-xs text-[#777166]">
                    Presupuesto: ${breakdown.subtotalArs.toLocaleString("es-AR")} + comisión Fiakto $
                    {breakdown.feeArs.toLocaleString("es-AR")}
                  </p>
                  <p className="mb-3 text-sm">{quote.description}</p>
                  {quote.status === "pending" && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => handleAccept(quote.id, "cash")}
                        disabled={acceptingId === quote.id}
                        className="w-full bg-[#dc4b2f] px-4 py-2 text-sm font-black text-white transition hover:bg-[#bd351f] disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {acceptingId === quote.id ? "Aceptando…" : "Aceptar y pagar en efectivo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleAccept(quote.id, "transfer")}
                        disabled={acceptingId === quote.id}
                        className="w-full border border-[#181713] px-4 py-2 text-sm font-black transition hover:bg-[#181713]/5 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {acceptingId === quote.id ? "Aceptando…" : "Aceptar y transferir a Fiakto"}
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
    </>
  );
}
