"use client";

import { useEffect, useRef, useState } from "react";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { formatSlaStatus } from "@/app/components/sla-status";
import { AppHeader } from "@/app/components/AppHeader";
import { isAdult } from "@/src/domain/profile";
import { requestNotificationPermission, showAppAlert } from "@/src/client/notify";

const POLL_INTERVAL_MS = 20_000;

type Opportunity = {
  id: string;
  description: string;
  // Puede faltar en datos viejos que se guardaron antes de que la ubicacion
  // fuera obligatoria en el schema (ver ServiceRequestSchema).
  location?: { locality: string; province: string };
  status: "open" | "quoted" | "accepted" | "in_progress" | "completed";
  professionalId?: string;
  slaDeadline?: string;
};

const STATUS_LABELS: Record<Opportunity["status"], string> = {
  open: "Abierta",
  // El listado ya incluye solicitudes "quoted" (otro profesional ya
  // presupuestó, pero los presupuestos son privados: todavía se puede
  // competir) y los propios trabajos "accepted" (esperando iniciar).
  quoted: "Abierta, con presupuestos",
  accepted: "Asignada a mí",
  in_progress: "En curso",
  completed: "Completada",
};

export default function OportunidadesPage() {
  const { user } = useAuth();
  const { ready } = useRoleGuard("professional", "/cliente/solicitudes");
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null);
  const [blockedMinor, setBlockedMinor] = useState(false);
  const [newAlert, setNewAlert] = useState<string | null>(null);
  // IDs de oportunidades disponibles para presupuestar (open/quoted) en el
  // último fetch, para detectar cuáles son nuevas en el próximo. null =
  // todavía no hubo un primer fetch, para no alertar de golpe con todo lo
  // que ya existía al entrar a la página.
  const knownOpenIdsRef = useRef<Set<string> | null>(null);

  useEffect(() => {
    if (!ready || !user) return;
    requestNotificationPermission();

    async function load() {
      if (!user) return;
      const token = await user.getIdToken();
      const [profileResponse, requestsResponse] = await Promise.all([
        fetch("/api/profile", { headers: { authorization: `Bearer ${token}` } }),
        fetch("/api/requests", { headers: { authorization: `Bearer ${token}` } }),
      ]);
      if (profileResponse.ok) {
        const profile = (await profileResponse.json()) as { birthDate?: string };
        if (profile.birthDate && !isAdult(profile.birthDate, new Date())) {
          setBlockedMinor(true);
          return;
        }
      }
      if (!requestsResponse.ok) {
        setOpportunities([]);
        return;
      }
      const data = (await requestsResponse.json()) as { requests: Opportunity[] };
      setOpportunities(data.requests);

      const openNow = data.requests.filter((item) => item.status === "open" || item.status === "quoted");
      const knownOpenIds = knownOpenIdsRef.current;
      if (knownOpenIds) {
        const freshlyOpened = openNow.filter((item) => !knownOpenIds.has(item.id));
        if (freshlyOpened.length > 0) {
          setNewAlert(
            freshlyOpened.length === 1
              ? `Nueva oportunidad: ${freshlyOpened[0].description}`
              : `${freshlyOpened.length} oportunidades nuevas para presupuestar.`,
          );
          showAppAlert("Fiakto", "Hay una nueva oportunidad para presupuestar.");
        }
      }
      knownOpenIdsRef.current = new Set(openNow.map((item) => item.id));
    }

    void load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
    // `ready` faltaba de esta lista: si `user` queda seteado antes de que
    // `role` resuelva (ready todavía false), el efecto corre una vez, sale
    // temprano por el guard de arriba, y nunca se vuelve a ejecutar cuando
    // `ready` pasa a true después — la página queda colgada en "Cargando…"
    // para siempre, sin ningún pedido de red. Coincide con lo reportado:
    // a veces cuelga, a veces no, dependiendo de qué orden resuelvan.
  }, [ready, user]);

  if (blockedMinor) {
    return (
      <>
        <AppHeader />
        <main className="mx-auto flex min-h-[50vh] max-w-3xl items-center px-6 py-12">
          <p role="alert" className="text-base font-semibold">
            Fiakto es solo para mayores de 18 años. No podés ofrecer trabajos con la fecha de
            nacimiento que tenés guardada en tu perfil.
          </p>
        </main>
      </>
    );
  }

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

      {newAlert && (
        <div
          role="alert"
          className="mb-4 flex items-center justify-between gap-3 border border-[#dc4b2f] bg-[#dc4b2f]/10 px-4 py-3 text-sm font-semibold"
        >
          <span>{newAlert}</span>
          <button type="button" onClick={() => setNewAlert(null)} className="font-bold underline">
            Cerrar
          </button>
        </div>
      )}

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
