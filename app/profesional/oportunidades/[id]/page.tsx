"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { formatSlaStatus } from "@/app/components/sla-status";
import { AppHeader } from "@/app/components/AppHeader";

// Leaflet toca `window` al importarse: solo puede correr en el cliente.
const ApproximateMap = dynamic(
  () => import("@/app/components/ApproximateMap").then((mod) => mod.ApproximateMap),
  { ssr: false }
);

type OpportunityDetail = {
  id: string;
  description: string;
  // Puede faltar en datos viejos que se guardaron antes de que la ubicacion
  // fuera obligatoria en el schema (ver ServiceRequestSchema).
  location?: { lat: number; lng: number; displayRadiusKm: number; locality: string; province: string };
  status: "open" | "quoted" | "accepted" | "in_progress" | "completed" | "closed";
  professionalId?: string;
  slaHours?: number;
  slaDeadline?: string;
  workStartedAt?: string;
  workCompletedAt?: string;
};

type OwnQuote = {
  id: string;
  status: "pending" | "accepted" | "rejected";
};

const OWN_QUOTE_MESSAGE: Record<OwnQuote["status"], string> = {
  pending: "Ya enviaste tu presupuesto. Esperando que el cliente decida.",
  accepted: "El cliente aceptó tu presupuesto.",
  rejected: "El cliente eligió el presupuesto de otro profesional para este trabajo.",
};

const CAN_QUOTE_STATUSES: OpportunityDetail["status"][] = ["open", "quoted"];
const ASSIGNED_STATUSES: OpportunityDetail["status"][] = ["accepted", "in_progress", "completed"];
const REPORTABLE_STATUSES: OpportunityDetail["status"][] = ["accepted", "in_progress", "completed", "closed"];

export default function OportunidadDetallePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { ready } = useRoleGuard("professional", "/cliente/solicitudes");
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [ownQuote, setOwnQuote] = useState<OwnQuote | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not-found" | "forbidden">("loading");
  const [actionPending, setActionPending] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);

  const [quoteForm, setQuoteForm] = useState({
    laborArs: "",
    materialsArs: "",
    description: "",
    estimatedHours: "",
  });
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submittingQuote, setSubmittingQuote] = useState(false);

  const [reportReason, setReportReason] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "submitting" | "done" | "error">("idle");

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch(`/api/requests/${params.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.status === 404) return setStatus("not-found");
      if (response.status === 403) return setStatus("forbidden");
      if (!response.ok) return setStatus("not-found");
      const data = (await response.json()) as OpportunityDetail;
      setOpportunity(data);

      if (CAN_QUOTE_STATUSES.includes(data.status)) {
        const quotesResponse = await fetch(`/api/requests/${params.id}/quotes`, {
          headers: { authorization: `Bearer ${token}` },
        });
        if (quotesResponse.ok) {
          const quotesData = (await quotesResponse.json()) as { quote: OwnQuote | null };
          setOwnQuote(quotesData.quote);
        }
      } else {
        setOwnQuote(null);
      }
      setStatus("ok");
    })();
    // `ready` faltaba de esta lista — mismo bug que en
    // app/profesional/oportunidades/client.tsx y
    // app/cliente/solicitudes/client.tsx: si `user` se setea antes de que
    // `role` resuelva, el efecto corre una vez, sale temprano, y nunca se
    // reintenta cuando `ready` pasa a true.
  }, [ready, user, params.id, reloadIndex]);

  async function handleStart() {
    if (!user) return;
    setActionPending(true);
    const token = await user.getIdToken();
    await fetch(`/api/requests/${params.id}/start`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    setActionPending(false);
    setReloadIndex((n) => n + 1);
  }

  async function handleComplete() {
    if (!user) return;
    setActionPending(true);
    const token = await user.getIdToken();
    await fetch(`/api/requests/${params.id}/complete`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    setActionPending(false);
    setReloadIndex((n) => n + 1);
  }

  async function handleSubmitQuote(event: FormEvent) {
    event.preventDefault();
    if (!user) return;
    setSubmittingQuote(true);
    setQuoteError(null);
    const token = await user.getIdToken();
    const response = await fetch(`/api/requests/${params.id}/quotes`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        laborArs: Number(quoteForm.laborArs),
        materialsArs: Number(quoteForm.materialsArs),
        description: quoteForm.description,
        estimatedHours: Number(quoteForm.estimatedHours),
      }),
    });
    setSubmittingQuote(false);
    if (!response.ok) {
      setQuoteError(
        "No pudimos enviar tu presupuesto. Revisá los montos, la descripción (mínimo 20 caracteres) y las horas estimadas.",
      );
      return;
    }
    setReloadIndex((n) => n + 1);
  }

  async function handleReport(event: FormEvent) {
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

  if (status === "forbidden") {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p>Esta oportunidad no coincide con tus oficios o zona de cobertura.</p>
        </main>
      </>
    );
  }

  if (status === "not-found" || !opportunity) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p>No encontramos esta solicitud.</p>
        </main>
      </>
    );
  }

  const assignedToSomeoneElse =
    ASSIGNED_STATUSES.includes(opportunity.status) && opportunity.professionalId !== user?.uid;

  return (
    <>
    <AppHeader />
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold">Detalle de la solicitud</h1>
      <p className="mb-4 text-sm text-[#777166]">
        {opportunity.location
          ? `${opportunity.location.locality}, ${opportunity.location.province}`
          : "Ubicación no disponible"}
      </p>
      <p className="mb-6">{opportunity.description}</p>

      {opportunity.location && (
        <>
          <h2 className="mb-2 text-lg font-semibold">Zona aproximada</h2>
          <p className="mb-3 text-sm text-[#777166]">
            No vemos la dirección exacta hasta aceptar el trabajo — así podés evaluar si te
            conviene por la zona antes de comprometerte.
          </p>
          <ApproximateMap
            center={{ lat: opportunity.location.lat, lng: opportunity.location.lng }}
            radiusKm={opportunity.location.displayRadiusKm}
          />
        </>
      )}

      <div className="mt-8 border-t border-[#181713]/15 pt-6">
        {assignedToSomeoneElse && (
          <p className="text-sm font-semibold text-[#777166]">
            Este trabajo ya fue asignado a otro profesional.
          </p>
        )}

        {!assignedToSomeoneElse && CAN_QUOTE_STATUSES.includes(opportunity.status) && (
          ownQuote ? (
            <p className="text-sm font-bold text-[#181713]">{OWN_QUOTE_MESSAGE[ownQuote.status]}</p>
          ) : (
            <form onSubmit={handleSubmitQuote} className="flex flex-col gap-4">
              <h2 className="text-lg font-semibold">Enviar presupuesto</h2>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Mano de obra (ARS)
                <input
                  type="number"
                  min="1"
                  step="1"
                  required
                  value={quoteForm.laborArs}
                  onChange={(event) => setQuoteForm((form) => ({ ...form, laborArs: event.target.value }))}
                  className="rounded border border-[#181713]/20 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Materiales (ARS)
                <input
                  type="number"
                  min="0"
                  step="1"
                  required
                  value={quoteForm.materialsArs}
                  onChange={(event) => setQuoteForm((form) => ({ ...form, materialsArs: event.target.value }))}
                  className="rounded border border-[#181713]/20 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Horas estimadas
                <input
                  type="number"
                  min="1"
                  step="0.5"
                  required
                  value={quoteForm.estimatedHours}
                  onChange={(event) => setQuoteForm((form) => ({ ...form, estimatedHours: event.target.value }))}
                  className="rounded border border-[#181713]/20 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium">
                Descripción del trabajo
                <textarea
                  required
                  minLength={20}
                  maxLength={1500}
                  rows={4}
                  value={quoteForm.description}
                  onChange={(event) => setQuoteForm((form) => ({ ...form, description: event.target.value }))}
                  className="rounded border border-[#181713]/20 px-3 py-2"
                />
              </label>
              {quoteError && (
                <p role="alert" className="text-sm font-semibold text-[#b52f1c]">
                  {quoteError}
                </p>
              )}
              <button
                type="submit"
                disabled={submittingQuote}
                className="w-full bg-[#dc4b2f] px-6 py-4 text-base font-black text-white transition hover:bg-[#bd351f] disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submittingQuote ? "Enviando…" : "Enviar presupuesto"}
              </button>
            </form>
          )
        )}

        {!assignedToSomeoneElse && opportunity.status === "accepted" && (
          <button
            type="button"
            onClick={handleStart}
            disabled={actionPending}
            className="w-full bg-[#dc4b2f] px-6 py-4 text-base font-black text-white transition hover:bg-[#bd351f] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {actionPending ? "Iniciando…" : "Iniciar trabajo"}
          </button>
        )}

        {opportunity.status === "in_progress" && opportunity.slaDeadline && (
          <>
            <SlaBanner slaDeadline={opportunity.slaDeadline} />
            <button
              type="button"
              onClick={handleComplete}
              disabled={actionPending}
              className="mt-4 w-full bg-[#181713] px-6 py-4 text-base font-black text-white transition hover:bg-[#181713]/90 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {actionPending ? "Guardando…" : "Marcar como completado"}
            </button>
          </>
        )}

        {opportunity.status === "completed" && !assignedToSomeoneElse && (
          <p className="text-sm font-bold text-[#34745a]">
            Trabajo completado
            {opportunity.workCompletedAt &&
              ` el ${new Date(opportunity.workCompletedAt).toLocaleString("es-AR")}`}
            .
          </p>
        )}
      </div>

      {!assignedToSomeoneElse && REPORTABLE_STATUSES.includes(opportunity.status) && (
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
    </main>
    </>
  );
}

function SlaBanner({ slaDeadline }: { slaDeadline: string }) {
  const [sla, setSla] = useState(() => formatSlaStatus(slaDeadline));

  useEffect(() => {
    const interval = setInterval(() => setSla(formatSlaStatus(slaDeadline)), 60_000);
    return () => clearInterval(interval);
  }, [slaDeadline]);

  return (
    <p
      className={`border-l-2 pl-4 text-sm font-bold leading-6 ${
        sla.overdue ? "border-[#b52f1c] text-[#b52f1c]" : "border-[#dc4b2f] text-[#181713]"
      }`}
    >
      Ventana de reparación: {sla.label}.
    </p>
  );
}
