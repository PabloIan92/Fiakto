"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";

type RequestItem = {
  id: string;
  description: string;
  status: "draft" | "triaging" | "open" | "quoted" | "accepted" | "closed";
  location: { locality: string; province: string };
};

const STATUS_LABELS: Record<RequestItem["status"], string> = {
  draft: "Borrador",
  triaging: "En análisis",
  open: "Publicada, esperando presupuestos",
  quoted: "Con presupuestos",
  accepted: "Aceptada",
  closed: "Cerrada",
};

const STATUS_COLORS: Record<RequestItem["status"], string> = {
  draft: "bg-neutral-200 text-neutral-700",
  triaging: "bg-amber-100 text-amber-800",
  open: "bg-blue-100 text-blue-800",
  quoted: "bg-purple-100 text-purple-800",
  accepted: "bg-green-100 text-green-800",
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
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
