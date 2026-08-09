"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";
import { formatSlaStatus } from "@/app/components/sla-status";

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
  location: { locality: string; province: string };
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
  const { user, loading: authLoading } = useAuth();
  const [requests, setRequests] = useState<RequestItem[] | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch("/api/requests", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = (await response.json()) as { requests: RequestItem[] };
        setRequests(data.requests);
      } else {
        setRequests([]);
      }
    })();
  }, [user]);

  if (authLoading || requests === null) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p>Cargando tus solicitudes…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis solicitudes</h1>
        <a href="/cliente/solicitudes/nueva" className="rounded bg-[#181713] px-4 py-2 text-white">
          Nueva solicitud
        </a>
      </div>

      {requests.length === 0 ? (
        <p className="text-[#777166]">Todavía no publicaste ninguna solicitud.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((item) => (
            <li
              key={item.id}
              className="flex flex-col gap-2 rounded-lg border border-[#181713]/10 p-4"
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`w-fit rounded-full px-3 py-1 text-xs font-medium ${STATUS_COLORS[item.status]}`}
                >
                  {STATUS_LABELS[item.status]}
                </span>
                <span className="text-sm text-[#777166]">
                  {item.location.locality}, {item.location.province}
                </span>
              </div>
              <p className="line-clamp-2 text-sm">{item.description}</p>
              {item.status === "in_progress" && item.slaDeadline && (
                <SlaBadge slaDeadline={item.slaDeadline} />
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
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
