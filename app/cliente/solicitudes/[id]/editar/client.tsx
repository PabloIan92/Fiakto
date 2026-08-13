"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { AppHeader } from "@/app/components/AppHeader";

// Leaflet toca `window` al importarse: solo puede correr en el cliente.
const MapPicker = dynamic(
  () => import("@/app/components/MapPicker").then((mod) => mod.MapPicker),
  { ssr: false }
);

type RequestDetail = {
  description: string;
  location?: { lat: number; lng: number; displayRadiusKm: number; province: string; locality: string };
  status: "draft" | "triaging" | "open" | "quoted" | "accepted" | "in_progress" | "completed" | "closed";
};

export default function EditarSolicitudPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { ready } = useRoleGuard("customer", "/profesional/oportunidades");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [province, setProvince] = useState("Buenos Aires");
  const [locality, setLocality] = useState("");
  const [radiusKm, setRadiusKm] = useState(3);
  const [status, setStatus] = useState<"loading" | "ok" | "not-found" | "not-editable">("loading");
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "error">("idle");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch(`/api/requests/${params.id}`, {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) return setStatus("not-found");
      const data = (await response.json()) as RequestDetail;
      if (!["draft", "triaging", "open", "quoted"].includes(data.status)) {
        setStatus("not-editable");
        return;
      }
      setDescription(data.description);
      if (data.location) {
        setLocation({ lat: data.location.lat, lng: data.location.lng });
        setProvince(data.location.province);
        setLocality(data.location.locality);
        setRadiusKm(data.location.displayRadiusKm);
      }
      setStatus("ok");
    })();
  }, [ready, user, params.id]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) {
      setSaveError("Seleccioná tu ubicación en el mapa.");
      return;
    }
    if (!locality.trim()) {
      setSaveError("Ingresá tu localidad.");
      return;
    }
    if (!user) return;
    setSaveStatus("saving");
    setSaveError("");
    const token = await user.getIdToken();
    const response = await fetch(`/api/requests/${params.id}`, {
      method: "PUT",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({
        description,
        location: { lat: location.lat, lng: location.lng, displayRadiusKm: radiusKm, province, locality },
      }),
    });
    if (!response.ok) {
      setSaveStatus("error");
      setSaveError("No pudimos guardar los cambios. Probá de nuevo.");
      return;
    }
    const { resetTriage } = (await response.json()) as { resetTriage: boolean };
    // Igual que al crear una solicitud: si cambió la descripción, el
    // triage anterior ya no sirve y hay que volver a analizarla.
    if (resetTriage) {
      try {
        await fetch(`/api/requests/${params.id}/triage`, { method: "POST" });
      } catch {
        // Fallo de red: la solicitud queda en "triaging", se puede
        // reintentar desde /cliente/solicitudes.
      }
    }
    router.push(`/cliente/solicitudes/${params.id}`);
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

  if (status === "not-found") {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p>No encontramos esta solicitud.</p>
        </main>
      </>
    );
  }

  if (status === "not-editable") {
    return (
      <>
        <AppHeader />
        <main className="mx-auto max-w-2xl px-6 py-12">
          <p role="alert" className="mb-4">
            Esta solicitud ya tiene un presupuesto aceptado y no se puede editar.
          </p>
          <Link href={`/cliente/solicitudes/${params.id}`} className="text-sm font-bold underline">
            Volver al detalle
          </Link>
        </main>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-2xl px-6 py-12">
        <Link href={`/cliente/solicitudes/${params.id}`} className="mb-4 inline-block text-sm underline">
          Volver al detalle
        </Link>
        <h1 className="mb-6 text-2xl font-bold">Editar solicitud</h1>

        <form onSubmit={handleSubmit} className="border border-[#181713]/20 bg-[#fffdf8] p-5 shadow-[8px_8px_0_#181713] sm:p-8">
          <div className="space-y-7">
            <label htmlFor="description" className="block">
              <span className="mb-2 block text-sm font-bold">¿Qué necesitás resolver?</span>
              <textarea
                id="description"
                aria-label="¿Qué necesitás resolver?"
                required
                minLength={20}
                maxLength={2000}
                rows={6}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                className="w-full resize-y border border-[#181713]/30 bg-transparent px-4 py-3 text-base outline-none transition focus:border-[#dc4b2f] focus:ring-2 focus:ring-[#dc4b2f]/20"
              />
              <span className="mt-2 block text-xs text-[#777166]">
                Si cambiás esto, Fiakto vuelve a analizar la solicitud con IA.
              </span>
            </label>

            <label htmlFor="location" className="block">
              <span className="mb-1 block text-sm font-bold">¿Dónde es el trabajo?</span>
              <MapPicker value={location} onChange={setLocation} radiusKm={radiusKm} />
              <div className="mt-3 grid gap-4 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label htmlFor="locality" className="block">
                    <span className="mb-2 block text-sm font-bold">Localidad</span>
                    <input
                      id="locality"
                      aria-label="Localidad"
                      value={locality}
                      onChange={(e) => setLocality(e.target.value)}
                      required
                      minLength={2}
                      className="h-12 w-full border border-[#181713]/30 bg-transparent px-4 outline-none focus:border-[#dc4b2f]"
                    />
                  </label>
                </div>
                <div>
                  <label htmlFor="radius" className="block">
                    <span className="mb-2 block text-sm font-bold">Radio de visibilidad</span>
                    <select
                      id="radius"
                      value={radiusKm}
                      onChange={(e) => setRadiusKm(Number(e.target.value))}
                      className="h-12 w-full border border-[#181713]/30 bg-[#fffdf8] px-3 outline-none focus:border-[#dc4b2f]"
                    >
                      <option value={1}>1 km (muy preciso)</option>
                      <option value={2}>2 km</option>
                      <option value={3}>3 km (recomendado)</option>
                      <option value={5}>5 km</option>
                      <option value={10}>10 km (amplio)</option>
                    </select>
                  </label>
                </div>
              </div>
              <div className="mt-3 grid gap-4 sm:grid-cols-2">
                <div>
                  <label htmlFor="province" className="block">
                    <span className="mb-2 block text-sm font-bold">Provincia</span>
                    <select
                      id="province"
                      value={province}
                      onChange={(e) => setProvince(e.target.value)}
                      className="h-12 w-full border border-[#181713]/30 bg-[#fffdf8] px-3 outline-none focus:border-[#dc4b2f]"
                    >
                      <option>Ciudad Autónoma de Buenos Aires</option>
                      <option>Buenos Aires</option>
                      <option>Córdoba</option>
                      <option>Santa Fe</option>
                      <option>Otra provincia</option>
                    </select>
                  </label>
                </div>
              </div>
            </label>
          </div>

          <div className="mt-8 border-t border-[#181713]/15 pt-6">
            <button
              type="submit"
              disabled={saveStatus === "saving" || !location}
              className="w-full bg-[#dc4b2f] px-6 py-4 text-base font-black text-white transition hover:bg-[#bd351f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saveStatus === "saving" ? "Guardando…" : "Guardar cambios"}
            </button>
            {saveError && (
              <p role="alert" className="mt-3 text-center text-xs font-semibold text-[#b52f1c]">
                {saveError}
              </p>
            )}
          </div>
        </form>
      </main>
    </>
  );
}
