"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { useAuth } from "@/app/providers/AuthProvider";
import { auth } from "@/src/client/firebase-client";
import { clearSession } from "@/src/client/session-sync";
import { TRADES, TRADE_LABELS, type UserProfile } from "@/src/domain/profile";

// Leaflet toca `window` al importarse: solo puede correr en el cliente.
const MapPicker = dynamic(
  () => import("@/app/components/MapPicker").then((mod) => mod.MapPicker),
  { ssr: false }
);

type FormState = {
  phone: string;
  birthDate: string;
  province: string;
  locality: string;
  exactAddress: string;
  lat: number | null;
  lng: number | null;
  trades: string[];
  coverage: string;
};

const EMPTY_FORM: FormState = {
  phone: "",
  birthDate: "",
  province: "",
  locality: "",
  exactAddress: "",
  lat: null,
  lng: null,
  trades: [],
  coverage: "",
};

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [saveError, setSaveError] = useState("");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch("/api/profile", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const profile = (await response.json()) as UserProfile & { photoUrl?: string };
        setForm({
          phone: profile.phone ?? "",
          birthDate: profile.birthDate ?? "",
          province: profile.location?.province ?? "",
          locality: profile.location?.locality ?? "",
          exactAddress: profile.location?.exactAddress ?? "",
          lat: profile.location?.lat ?? null,
          lng: profile.location?.lng ?? null,
          trades: profile.trades ?? [],
          coverage: (profile.coverage ?? []).join(", "),
        });
        setPhotoUrl(profile.photoUrl ?? null);
      }
      setLoading(false);
    })();
  }, [user, authLoading, router]);

  async function handlePhotoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !user) return;
    setPhotoError("");

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setPhotoError("Usá JPG, PNG o WEBP.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setPhotoError("La foto no puede superar los 3 MB.");
      return;
    }

    setUploadingPhoto(true);
    try {
      const token = await user.getIdToken();
      const photoBase64 = await readFileAsBase64(file);
      const response = await fetch("/api/profile/photo", {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
        body: JSON.stringify({ photoBase64, contentType: file.type }),
      });
      if (response.ok) {
        const data = (await response.json()) as { photoUrl: string };
        setPhotoUrl(data.photoUrl);
      } else {
        setPhotoError("No pudimos subir la foto. Probá de nuevo.");
      }
    } finally {
      setUploadingPhoto(false);
    }
  }

  async function handleSubmit() {
    if (!user) return;
    setSaving(true);
    setSavedAt(null);
    setSaveError("");
    const token = await user.getIdToken();
    const location =
      form.lat !== null && form.lng !== null && form.exactAddress && form.province && form.locality
        ? {
            lat: form.lat,
            lng: form.lng,
            province: form.province,
            locality: form.locality,
            exactAddress: form.exactAddress,
          }
        : undefined;

    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        phone: form.phone,
        birthDate: form.birthDate,
        location,
        trades: form.trades,
        coverage: form.coverage
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setSaveError(body?.error ?? "No pudimos guardar tu perfil. Revisá los datos e intentá de nuevo.");
      return;
    }
    setSavedAt(Date.now());
  }

  function toggleTrade(trade: string) {
    setForm((prev) => ({
      ...prev,
      trades: prev.trades.includes(trade)
        ? prev.trades.filter((item) => item !== trade)
        : [...prev.trades, trade],
    }));
  }

  if (authLoading || loading || !user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-12">
        <p>Cargando perfil…</p>
      </main>
    );
  }

  const backHref = role === "professional" ? "/profesional/oportunidades" : "/cliente/solicitudes";
  const backLabel = role === "professional" ? "Oportunidades" : "Mis solicitudes";

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <Link href={backHref} className="mb-4 inline-block text-sm font-medium underline">
        ← Volver a {backLabel}
      </Link>
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Mi perfil</h1>
          <p className="text-sm text-[#777166]">
            Estás en modo {role === "professional" ? "profesional" : "cliente"}. Para el otro
            modo, cerrá sesión y volvé a entrar eligiéndolo.
          </p>
        </div>
        <button
          type="button"
          className="w-fit shrink-0 text-sm font-medium underline"
          onClick={async () => {
            if (auth) await signOut(auth);
            await clearSession();
            router.push("/login");
          }}
        >
          Cerrar sesión
        </button>
      </div>

      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Teléfono *</span>
          <input
            type="tel"
            required
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            className="rounded border border-[#181713]/20 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span>Fecha de nacimiento *</span>
          <input
            type="date"
            required
            value={form.birthDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={(event) => setForm((prev) => ({ ...prev, birthDate: event.target.value }))}
            className="w-fit rounded border border-[#181713]/20 px-3 py-2"
          />
          <span className="text-xs text-[#777166]">
            Fiakto es solo para mayores de 18 años.
          </span>
        </label>

        {role === "customer" && (
          <>
            <h2 className="text-lg font-semibold">Mi domicilio</h2>
            <p className="text-sm text-[#777166]">
              Este es tu domicilio exacto: solo vos lo ves con precisión. A los profesionales
              únicamente les mostramos la zona aproximada de cada solicitud.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <label className="flex flex-col gap-1">
                <span>Provincia</span>
                <input
                  value={form.province}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, province: event.target.value }))
                  }
                  className="rounded border border-[#181713]/20 px-3 py-2"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span>Localidad</span>
                <input
                  value={form.locality}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, locality: event.target.value }))
                  }
                  className="rounded border border-[#181713]/20 px-3 py-2"
                />
              </label>
            </div>
            <label className="flex flex-col gap-1">
              <span>Dirección</span>
              <input
                value={form.exactAddress}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, exactAddress: event.target.value }))
                }
                className="rounded border border-[#181713]/20 px-3 py-2"
              />
            </label>
            <p className="text-sm font-medium">
              Hacé click en el mapa para marcar tu ubicación exacta (después podés arrastrar el
              marcador para ajustarla).
            </p>
            <MapPicker
              value={form.lat !== null && form.lng !== null ? { lat: form.lat, lng: form.lng } : null}
              onChange={({ lat, lng }) => setForm((prev) => ({ ...prev, lat, lng }))}
            />
          </>
        )}

        {role === "professional" && (
          <>
            <h2 className="text-lg font-semibold">Foto de perfil *</h2>
            <p className="text-sm text-[#777166]">
              Una foto de tu cara ayuda a que los clientes confíen en vos. Es obligatoria para
              aparecer en las solicitudes abiertas.
            </p>
            <div className="flex items-center gap-4">
              {photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- foto firmada de Storage, no un asset local
                <img
                  src={photoUrl}
                  alt="Tu foto de perfil"
                  className="h-20 w-20 rounded-full border border-[#181713]/20 object-cover"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full border border-dashed border-[#181713]/30 text-xs text-[#777166]">
                  Sin foto
                </div>
              )}
              <label className="cursor-pointer rounded border border-[#181713]/20 px-4 py-2 text-sm font-medium hover:bg-[#181713]/5">
                {uploadingPhoto ? "Subiendo…" : photoUrl ? "Cambiar foto" : "Subir foto"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handlePhotoChange}
                  disabled={uploadingPhoto}
                  className="hidden"
                />
              </label>
            </div>
            {photoError && (
              <p role="alert" className="text-sm text-red-600">
                {photoError}
              </p>
            )}

            <h2 className="text-lg font-semibold">Mis oficios</h2>
            <div className="flex flex-wrap gap-2">
              {TRADES.map((trade) => (
                <button
                  key={trade}
                  type="button"
                  onClick={() => toggleTrade(trade)}
                  aria-pressed={form.trades.includes(trade)}
                  className={`rounded-full border px-3 py-1 text-sm ${
                    form.trades.includes(trade)
                      ? "border-[#dc4b2f] bg-[#dc4b2f] text-white"
                      : "border-[#181713]/20"
                  }`}
                >
                  {TRADE_LABELS[trade]}
                </button>
              ))}
            </div>
            <label className="flex flex-col gap-1">
              <span>Zonas de cobertura (localidades, separadas por coma)</span>
              <input
                value={form.coverage}
                onChange={(event) =>
                  setForm((prev) => ({ ...prev, coverage: event.target.value }))
                }
                className="rounded border border-[#181713]/20 px-3 py-2"
              />
            </label>
          </>
        )}


        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving}
          className="w-fit rounded bg-[#181713] px-4 py-2 text-white disabled:opacity-60"
        >
          {saving ? "Guardando…" : "Guardar"}
        </button>
        {savedAt && <p className="text-sm text-green-700">Perfil guardado.</p>}
        {saveError && (
          <p role="alert" className="text-sm text-red-600">
            {saveError}
          </p>
        )}
      </section>
    </main>
  );
}
