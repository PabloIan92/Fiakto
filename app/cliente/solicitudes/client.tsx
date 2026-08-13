"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { formatSlaStatus } from "@/app/components/sla-status";
import { AppHeader } from "@/app/components/AppHeader";

type RequestItem = {
  id: string;
  description: string;
  status:
    | "draft"
    | "triaging"
    | "open"
    | "quoted"
    | "accepted"
    | "in_progress"
    | "completed"
    | "closed";
  // Puede faltar en datos viejos que se guardaron antes de que la ubicacion
  // fuera obligatoria en el schema (ver ServiceRequestSchema).
  location?: { locality: string; province: string };
  slaDeadline?: string;
};

const STATUS_LABELS: Record<RequestItem["status"], string> = {
  draft: "Borrador",
  triaging: "En análisis",
  open: "Publicada, esperando presupuestos",
  quoted: "Con presupuestos",
  accepted: "Aceptada",
  in_progress: "En reparación",
  completed: "Completada",
  closed: "Cerrada",
};

const EDITABLE_STATUSES: RequestItem["status"][] = ["draft", "triaging", "open", "quoted"];

const STATUS_COLORS: Record<RequestItem["status"], string> = {
  draft: "bg-neutral-200 text-neutral-700",
  triaging: "bg-amber-100 text-amber-800",
  open: "bg-blue-100 text-blue-800",
  quoted: "bg-purple-100 text-purple-800",
  accepted: "bg-green-100 text-green-800",
  in_progress: "bg-orange-100 text-orange-800",
  completed: "bg-emerald-100 text-emerald-800",
  closed: "bg-neutral-300 text-neutral-700",
};

export default function MisSolicitudesPage() {
  const { user } = useAuth();
  const { ready } = useRoleGuard("customer", "/profesional/oportunidades");
  const [requests, setRequests] = useState<RequestItem[] | null>(null);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [retryError, setRetryError] = useState<string | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    void loadRequests(user);
    // `ready` faltaba de esta lista: si `user` queda seteado antes de que
    // `role` resuelva (ready todavía false), el efecto corre una vez, sale
    // temprano por el guard de arriba, y nunca se vuelve a ejecutar cuando
    // `ready` pasa a true después — la página queda colgada en "Cargando…"
    // para siempre, sin ningún pedido de red.
  }, [ready, user]);

  async function loadRequests(currentUser: NonNullable<typeof user>) {
    const token = await currentUser.getIdToken();
    const response = await fetch("/api/requests", {
      headers: { authorization: `Bearer ${token}` },
    });
    if (response.ok) {
      const data = (await response.json()) as { requests: RequestItem[] };
      setRequests(data.requests);
    } else {
      setRequests([]);
    }
  }

  async function retryAnalysis(id: string) {
    if (!user) return;
    setRetryingId(id);
    setRetryError(null);
    try {
      const token = await user.getIdToken();
      const response = await fetch(`/api/requests/${id}/triage`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        setRetryError("No pudimos analizar la solicitud. Probá de nuevo en un momento.");
      }
      await loadRequests(user);
    } finally {
      setRetryingId(null);
    }
  }

  if (!ready || requests === null) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <p>Cargando tus solicitudes…</p>
        </main>
      </>
    );
  }

  return (
    <>
    <AppHeader />
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis solicitudes</h1>
        <Link href="/cliente/solicitudes/nueva" className="rounded bg-[#181713] px-4 py-2 text-white">
          Nueva solicitud
        </Link>
      </div>

      {retryError && (
        <p role="alert" className="mb-4 text-sm font-semibold text-[#b52f1c]">
          {retryError}
        </p>
      )}

      {requests.length === 0 ? (
        <p className="text-[#777166]">Todavía no publicaste ninguna solicitud.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-lg border border-[#181713]/10 p-4"
            >
              <a href={`/cliente/solicitudes/${item.id}`} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[item.status]}`}
                  >
                    {STATUS_LABELS[item.status]}
                  </span>
                  <span className="text-sm text-[#777166]">
                    {item.location
                      ? `${item.location.locality}, ${item.location.province}`
                      : "Ubicación no disponible"}
                  </span>
                </div>
                <p className="line-clamp-2 text-sm">{item.description}</p>
                {item.status === "in_progress" && item.slaDeadline && (
                  <SlaBadge slaDeadline={item.slaDeadline} />
                )}
                <span className="text-sm font-medium underline">Ver detalle y presupuestos</span>
              </a>
              {EDITABLE_STATUSES.includes(item.status) && (
                <Link
                  href={`/cliente/solicitudes/${item.id}/editar`}
                  className="w-fit text-xs font-bold underline"
                >
                  Editar
                </Link>
              )}
              {item.status === "draft" && (
                <div className="mt-1 flex items-center gap-3">
                  <span className="text-xs text-[#777166]">
                    El análisis con IA no se completó todavía.
                  </span>
                  <button
                    type="button"
                    onClick={() => retryAnalysis(item.id)}
                    disabled={retryingId === item.id}
                    className="rounded bg-[#181713] px-3 py-1.5 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {retryingId === item.id ? "Analizando…" : "Reintentar análisis"}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
    </>
  );
}

function SlaBadge({ slaDeadline }: { slaDeadline: string }) {
  const [sla, setSla] = useState(() => formatSlaStatus(slaDeadline));

  useEffect(() => {
    const interval = setInterval(() => setSla(formatSlaStatus(slaDeadline)), 60_000);
    return () => clearInterval(interval);
  }, [slaDeadline]);

  return (
    <span className={`text-xs font-bold ${sla.overdue ? "text-[#b52f1c]" : "text-[#dc4b2f]"}`}>
      {sla.label}
    </span>
  );
}
