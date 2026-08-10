"use client";

import { useEffect, useState } from "react";
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
  status: "open" | "in_progress" | "completed";
  slaHours?: number;
  slaDeadline?: string;
  workStartedAt?: string;
  workCompletedAt?: string;
};

export default function OportunidadDetallePage() {
  const params = useParams<{ id: string }>();
  const { user } = useAuth();
  const { ready } = useRoleGuard("professional", "/cliente/solicitudes");
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not-found" | "forbidden">("loading");
  const [actionPending, setActionPending] = useState(false);
  const [reloadIndex, setReloadIndex] = useState(0);

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
      setOpportunity((await response.json()) as OpportunityDetail);
      setStatus("ok");
    })();
  }, [user, params.id, reloadIndex]);

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
        {opportunity.status === "open" && (
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

        {opportunity.status === "completed" && (
          <p className="text-sm font-bold text-[#34745a]">
            Trabajo completado
            {opportunity.workCompletedAt &&
              ` el ${new Date(opportunity.workCompletedAt).toLocaleString("es-AR")}`}
            .
          </p>
        )}
      </div>
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
