"use client";

import { useEffect, useState } from "react";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { formatSlaStatus } from "@/app/components/sla-status";
import { AppHeader } from "@/app/components/AppHeader";

type Opportunity = {
  id: string;
  description: string;
  // Puede faltar en datos viejos que se guardaron antes de que la ubicacion
  // fuera obligatoria en el schema (ver ServiceRequestSchema).
  location?: { locality: string; province: string };
  status: "open" | "in_progress" | "completed";
  slaDeadline?: string;
};

const STATUS_LABELS: Record<Opportunity["status"], string> = {
  open: "Abierta",
  in_progress: "En curso",
  completed: "Completada",
};

export default function OportunidadesPage() {
  const { user } = useAuth();
  const { ready } = useRoleGuard("professional", "/cliente/solicitudes");
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch("/api/requests", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = (await response.json()) as { requests: Opportunity[] };
        setOpportunities(data.requests);
      } else {
        setOpportunities([]);
      }
    })();
  }, [user]);

  if (!ready || opportunities === null) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-3xl px-6 py-12">
          <p>Cargando oportunidades…</p>
        </main>
      </>
    );
  }

  return (
    <>
    <AppHeader />
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">Oportunidades y trabajos en curso</h1>

      {opportunities.length === 0 ? (
        <p className="text-[#777166]">
          Por ahora no hay solicitudes abiertas que coincidan con tus oficios y zonas de
          cobertura. Revisá tu perfil para ajustarlos.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {opportunities.map((item) => {
            const sla = item.status === "in_progress" && item.slaDeadline
              ? formatSlaStatus(item.slaDeadline)
              : null;
            return (
              <li key={item.id} className="rounded-lg border border-[#181713]/10 p-4">
                <a href={`/profesional/oportunidades/${item.id}`} className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-sm text-[#777166]">
                      {item.location
                        ? `${item.location.locality}, ${item.location.province}`
                        : "Ubicación no disponible"}
                    </span>
                    <span className="w-fit rounded-full border border-[#181713]/20 px-3 py-1 text-xs font-semibold">
                      {STATUS_LABELS[item.status]}
                    </span>
                  </div>
                  <p className="line-clamp-2 text-sm">{item.description}</p>
                  {sla && (
                    <span className={`text-xs font-bold ${sla.overdue ? "text-[#b52f1c]" : "text-[#dc4b2f]"}`}>
                      {sla.label}
                    </span>
                  )}
                  <span className="text-sm font-medium underline">Ver zona y detalle</span>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </main>
    </>
  );
}
