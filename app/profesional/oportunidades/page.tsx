"use client";

import { useEffect, useState } from "react";

import { useAuth } from "@/app/providers/AuthProvider";

type Opportunity = {
  id: string;
  description: string;
  location: { locality: string; province: string };
};

export default function OportunidadesPage() {
  const { user, loading: authLoading } = useAuth();
  const [opportunities, setOpportunities] = useState<Opportunity[] | null>(null);

  useEffect(() => {
    if (!user) return;
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

  if (authLoading || opportunities === null) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-12">
        <p>Cargando oportunidades…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">Oportunidades cerca tuyo</h1>

      {opportunities.length === 0 ? (
        <p className="text-[#777166]">
          Por ahora no hay solicitudes abiertas que coincidan con tus oficios y zonas de
          cobertura. Revisá tu perfil para ajustarlos.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {opportunities.map((item) => (
            <li key={item.id} className="rounded-lg border border-[#181713]/10 p-4">
              <a href={`/profesional/oportunidades/${item.id}`} className="flex flex-col gap-2">
                <span className="text-sm text-[#777166]">
                  {item.location.locality}, {item.location.province}
                </span>
                <p className="line-clamp-2 text-sm">{item.description}</p>
                <span className="text-sm font-medium underline">Ver zona y detalle</span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
