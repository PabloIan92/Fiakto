"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { type ChangeEvent, type FormEvent, useEffect, useState } from "react";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { isAdult } from "@/src/domain/profile";

// Leaflet toca `window` al importarse: solo puede correr en el cliente.
const MapPicker = dynamic(
  () => import("@/app/components/MapPicker").then((mod) => mod.MapPicker),
  { ssr: false }
);

const ACCEPTED_TYPES = [
  "image/jpeg",
  "image/png",
  "video/mp4",
  "audio/mpeg",
  "audio/mp4",
];
const MAX_FILES = 6;
const MAX_FILE_BYTES = 20 * 1024 * 1024;

export default function NewRequestPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { ready } = useRoleGuard("customer", "/profesional/oportunidades");
  const [files, setFiles] = useState<File[]>([]);
  const [fileError, setFileError] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">("idle");
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [province, setProvince] = useState("Buenos Aires");
  const [locality, setLocality] = useState("");
  const [radiusKm, setRadiusKm] = useState(3);
  const [blockedMinor, setBlockedMinor] = useState(false);

  // Si el cliente ya guardó su domicilio en /perfil, precargamos el mapa,
  // la localidad y la provincia con eso en vez de hacerlo repetir los tres
  // datos a mano en cada solicitud nueva. Sigue pudiendo mover el marcador
  // o cambiar el texto si el trabajo es en otro lado. De paso, si ya
  // guardó una fecha de nacimiento que lo marca como menor, bloqueamos la
  // publicación de solicitudes acá también (el guardado del perfil ya lo
  // impide, pero esto cubre a alguien que guardó el perfil antes de que
  // este chequeo existiera).
  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch("/api/profile", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (!response.ok) return;
      const profile = (await response.json()) as {
        location?: { lat: number; lng: number; province: string; locality: string };
        birthDate?: string;
      };
      if (profile.birthDate && !isAdult(profile.birthDate, new Date())) {
        setBlockedMinor(true);
        return;
      }
      if (!profile.location) return;
      setLocation({ lat: profile.location.lat, lng: profile.location.lng });
      setProvince(profile.location.province);
      setLocality(profile.location.locality);
    })();
  }, [ready, user]);

  function handleFiles(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    if (selected.length > MAX_FILES) {
      setFileError("Podés adjuntar hasta 6 archivos.");
      setFiles([]);
      return;
    }
    const invalid = selected.find(
      (file) => !ACCEPTED_TYPES.includes(file.type) || file.size > MAX_FILE_BYTES,
    );
    if (invalid) {
      setFileError("Usá JPG, PNG, MP4, MP3 o M4A de hasta 20 MB por archivo.");
      setFiles([]);
      return;
    }
    setFileError("");
    setFiles(selected);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!location) {
      setFileError("Seleccioná tu ubicación en el mapa.");
      return;
    }
    if (!locality.trim()) {
      setFileError("Ingresá tu localidad.");
      return;
    }
    setStatus("sending");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        description: form.get("description"),
        location: {
          lat: location.lat,
          lng: location.lng,
          displayRadiusKm: radiusKm,
          province,
          locality,
        },
        media: [],
      }),
    });
    if (!response.ok) {
      setStatus("error");
      return;
    }

    const { id } = (await response.json()) as { id: string };
    // Dispara el triage (Gemini) para esta solicitud recien creada. Antes
    // este paso nunca se llamaba desde el frontend: la solicitud quedaba
    // creada pero en "draft" para siempre, porque nada volvia a tocar el
    // documento. Si esta llamada falla (red o el propio endpoint), la
    // solicitud sigue existiendo en "draft" y el usuario puede reintentar
    // el analisis desde /cliente/solicitudes.
    try {
      await fetch(`/api/requests/${id}/triage`, { method: "POST" });
    } catch {
      // Fallo de red al llamar al triage: seguimos igual, ver comentario
      // arriba.
    }

    setStatus("done");
    router.push("/cliente/solicitudes");
  }

  if (!ready) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] text-[#181713]">
        <p>Cargando…</p>
      </main>
    );
  }

  if (blockedMinor) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] px-6 text-[#181713]">
        <p role="alert" className="max-w-md text-center text-base font-semibold">
          Fiakto es solo para mayores de 18 años. No podés publicar solicitudes con la fecha de
          nacimiento que tenés guardada en tu perfil.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f3efe6] text-[#181713]">
      <header className="border-b border-[#181713]/15 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-[-0.04em]">Fiakto.</Link>
          <div className="flex items-center gap-4">
            <Link href="/perfil" className="text-sm font-bold underline">Mi perfil</Link>
            <span className="rounded-full border border-[#181713]/20 px-3 py-1 text-xs font-semibold">
              Solicitud protegida
            </span>
          </div>
        </div>
      </header>

      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-10 sm:px-8 lg:grid-cols-[0.72fr_1.28fr] lg:py-16">
        <section aria-labelledby="request-title" className="lg:sticky lg:top-12 lg:self-start">
          <p className="mb-5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#dc4b2f]">
            Nueva solicitud / 01
          </p>
          <h1 id="request-title" className="max-w-md text-5xl font-black leading-[0.92] tracking-[-0.055em] sm:text-6xl">
            Contanos qué pasó.
          </h1>
          <p className="mt-6 max-w-sm text-base leading-7 text-[#565249]">
            Describí el problema con tus palabras. Fiakto organiza la información y busca al oficio adecuado.
          </p>
          <div className="mt-9 border-l-2 border-[#dc4b2f] pl-4 text-sm leading-6 text-[#565249]">
            Tu domicilio exacto permanece oculto hasta que aceptes y pagues un presupuesto.
          </div>
        </section>

        <form onSubmit={handleSubmit} className="border border-[#181713]/20 bg-[#fffdf8] p-5 shadow-[8px_8px_0_#181713] sm:p-8">
          <div className="space-y-7">
            <label htmlFor="description" className="block">
              <span className="mb-2 block text-sm font-bold">¿Qué necesitás resolver?</span>
              <textarea
                id="description"
                aria-label="¿Qué necesitás resolver?"
                name="description"
                required
                minLength={20}
                maxLength={2000}
                rows={6}
                placeholder="Ej: La canilla de la cocina pierde agua desde anoche..."
                className="w-full resize-y border border-[#181713]/30 bg-transparent px-4 py-3 text-base outline-none transition focus:border-[#dc4b2f] focus:ring-2 focus:ring-[#dc4b2f]/20"
              />
              <span className="mt-2 block text-xs text-[#777166]">Incluí desde cuándo ocurre y qué intentaste hacer.</span>
            </label>

            <label htmlFor="location" className="block">
              <span className="mb-1 block text-sm font-bold">¿Dónde es el trabajo?</span>
              <span className="mb-2 block text-xs text-[#777166]">
                Hacé click en el mapa para marcar el lugar (después podés arrastrar el marcador
                para ajustarlo).
              </span>
              <MapPicker
                value={location}
                onChange={setLocation}
                radiusKm={radiusKm}
              />
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
                      placeholder="Ej: Lanús"
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
                      aria-describedby="radius-hint"
                      className="h-12 w-full border border-[#181713]/30 bg-[#fffdf8] px-3 outline-none focus:border-[#dc4b2f]"
                    >
                      <option value={1}>1 km (muy preciso)</option>
                      <option value={2}>2 km</option>
                      <option value={3}>3 km (recomendado)</option>
                      <option value={5}>5 km</option>
                      <option value={10}>10 km (amplio)</option>
                    </select>
                  </label>
                  <span id="radius-hint" className="mt-1 block text-xs text-[#777166]">
                    Los profesionales verán una zona aproximada, no tu dirección exacta.
                  </span>
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

            <label htmlFor="media" className="block border border-dashed border-[#181713]/35 bg-[#f3efe6]/60 p-5">
              <span className="block text-sm font-bold">Fotos, video o audio (opcional)</span>
              <span className="mt-1 block text-xs leading-5 text-[#777166]">Hasta 6 archivos · 20 MB cada uno · JPG, PNG, MP4, MP3 o M4A</span>
              <input
                id="media"
                aria-label="Fotos, video o audio (opcional)"
                className="mt-4 block w-full text-sm file:mr-4 file:border-0 file:bg-[#181713] file:px-4 file:py-2 file:font-bold file:text-white"
                type="file"
                multiple
                accept={ACCEPTED_TYPES.join(",")}
                onChange={handleFiles}
              />
              {files.length > 0 && <span className="mt-3 block text-xs font-bold text-[#34745a]">{files.length} archivo(s) listo(s)</span>}
              {fileError && <span role="alert" className="mt-3 block text-xs font-bold text-[#b52f1c]">{fileError}</span>}
            </label>
          </div>

          <div className="mt-8 border-t border-[#181713]/15 pt-6">
            <button
              type="submit"
              disabled={status === "sending" || Boolean(fileError) || !location}
              className="w-full bg-[#dc4b2f] px-6 py-4 text-base font-black text-white transition hover:bg-[#bd351f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {status === "sending" ? "Analizando…" : "Analizar solicitud"}
            </button>
            <p aria-live="polite" className="mt-3 min-h-5 text-center text-xs font-semibold">
              {status === "done" && "Solicitud creada. Ya podemos analizarla."}
              {status === "error" && "No pudimos crearla. Revisá tu sesión e intentá nuevamente."}
            </p>
          </div>
        </form>
      </div>
    </main>
  );
}
