"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";

import { useAuth } from "@/app/providers/AuthProvider";

// Leaflet toca `window` al importarse: solo puede correr en el cliente.
const ApproximateMap = dynamic(
  () => import("@/app/components/ApproximateMap").then((mod) => mod.ApproximateMap),
  { ssr: false }
);

type OpportunityDetail = {
  id: string;
  description: string;
  location: { lat: number; lng: number; displayRadiusKm: number; locality: string; province: string };
};

export default function OportunidadDetallePage() {
  const params = useParams<{ id: string }>();
  const { user, loading: authLoading } = useAuth();
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "not-found" | "forbidden">("loading");

  useEffect(() => {
    if (!user) return;
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
  }, [user, params.id]);

  if (authLoading || status === "loading") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p>Cargando…</p>
      </main>
    );
  }

  if (status === "forbidden") {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p>Esta oportunidad no coincide con tus oficios o zona de cobertura.</p>
      </main>
    );
  }

  if (status === "not-found" || !opportunity) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p>No encontramos esta solicitud.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-2 text-2xl font-bold">Detalle de la solicitud</h1>
      <p className="mb-4 text-sm text-[#777166]">
        {opportunity.location.locality}, {opportunity.location.province}
      </p>
      <p className="mb-6">{opportunity.description}</p>

      <h2 className="mb-2 text-lg font-semibold">Zona aproximada</h2>
      <p className="mb-3 text-sm text-[#777166]">
        No vemos la dirección exacta hasta aceptar el trabajo — así podés evaluar si te
        conviene por la zona antes de comprometerte.
      </p>
      <ApproximateMap
        center={{ lat: opportunity.location.lat, lng: opportunity.location.lng }}
        radiusKm={opportunity.location.displayRadiusKm}
      />
    </main>
  );
}
