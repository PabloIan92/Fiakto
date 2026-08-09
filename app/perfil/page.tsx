"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";

import { useAuth } from "@/app/providers/AuthProvider";
import { TRADES, TRADE_LABELS, type UserProfile } from "@/src/domain/profile";

// Leaflet toca `window` al importarse: solo puede correr en el cliente.
const MapPicker = dynamic(
  () => import("@/app/components/MapPicker").then((mod) => mod.MapPicker),
  { ssr: false }
);

type FormState = {
  phone: string;
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
  province: "",
  locality: "",
  exactAddress: "",
  lat: null,
  lng: null,
  trades: [],
  coverage: "",
};

export default function PerfilPage() {
  const router = useRouter();
  const { user, role, loading: authLoading } = useAuth();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);

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
        const profile = (await response.json()) as UserProfile;
        setForm({
          phone: profile.phone ?? "",
          province: profile.location?.province ?? "",
          locality: profile.location?.locality ?? "",
          exactAddress: profile.location?.exactAddress ?? "",
          lat: profile.location?.lat ?? null,
          lng: profile.location?.lng ?? null,
          trades: profile.trades ?? [],
          coverage: (profile.coverage ?? []).join(", "),
        });
      }
      setLoading(false);
    })();
  }, [user, authLoading, router]);

  async function handleSubmit() {
    if (!user) return;
    setSaving(true);
    setSavedAt(null);
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

    await fetch("/api/profile", {
      method: "PUT",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        phone: form.phone,
        location,
        trades: form.trades,
        coverage: form.coverage
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      }),
    });
    setSaving(false);
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

  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <h1 className="mb-6 text-2xl font-bold">Mi perfil</h1>

      <section className="flex flex-col gap-4">
        <label className="flex flex-col gap-1">
          <span>Teléfono</span>
          <input
            type="tel"
            value={form.phone}
            onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
            className="rounded border border-[#181713]/20 px-3 py-2"
          />
        </label>

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
              onChange={(event) => setForm((prev) => ({ ...prev, province: event.target.value }))}
              className="rounded border border-[#181713]/20 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span>Localidad</span>
            <input
              value={form.locality}
              onChange={(event) => setForm((prev) => ({ ...prev, locality: event.target.value }))}
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
        <MapPicker
          value={form.lat !== null && form.lng !== null ? { lat: form.lat, lng: form.lng } : null}
          onChange={({ lat, lng }) => setForm((prev) => ({ ...prev, lat, lng }))}
        />

        {role === "professional" && (
          <>
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

        {role === "customer" && (
          <button
            type="button"
            className="w-fit text-sm underline"
            onClick={async () => {
              const token = await user.getIdToken();
              await fetch("/api/profile/become-professional", {
                method: "POST",
                headers: { authorization: `Bearer ${token}` },
              });
              const freshToken = await user.getIdToken(true);
              await fetch("/api/session", {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify({ idToken: freshToken }),
                credentials: "include",
              });
              window.location.reload();
            }}
          >
            ¿Sos profesional? Sumá tus oficios acá.
          </button>
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
      </section>
    </main>
  );
}
