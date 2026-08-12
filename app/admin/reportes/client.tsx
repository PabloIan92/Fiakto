"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { type FormEvent, useEffect, useState } from "react";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { auth } from "@/src/client/firebase-client";
import { clearSession } from "@/src/client/session-sync";

type AdminReport = {
  id: string;
  requestId: string;
  reporterId: string;
  reporterRole: "customer" | "professional";
  reason: string;
  status: "open" | "resolved";
  resolutionNote?: string;
  request: {
    description: string;
    province: string;
    locality: string;
    status: string;
  } | null;
};

const REPORTER_LABEL: Record<"customer" | "professional", string> = {
  customer: "Cliente",
  professional: "Profesional",
};

export default function AdminReportsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { ready } = useRoleGuard("admin", "/login");
  const [reports, setReports] = useState<AdminReport[]>([]);
  const [status, setStatus] = useState<"loading" | "ok">("loading");
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [resolving, setResolving] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/reports", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const body = (await response.json()) as { reports: AdminReport[] };
        setReports(body.reports);
      }
      setStatus("ok");
    })();
  }, [ready, user, reloadIndex]);

  async function handleResolve(reportId: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const note = notes[reportId]?.trim();
    if (!note) return;

    setResolving(reportId);
    setError(null);
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/reports/${reportId}/resolve`, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ note }),
    });
    setResolving(null);
    if (!response.ok) {
      setError("No pudimos resolver el reporte. Probá de nuevo.");
      return;
    }
    setReloadIndex((n) => n + 1);
  }

  async function handleLogout() {
    if (auth) await signOut(auth);
    await clearSession();
    router.push("/login");
  }

  if (!ready || status === "loading") {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3efe6] text-[#181713]">
        <p>Cargando…</p>
      </main>
    );
  }

  const openReports = reports.filter((report) => report.status === "open");
  const resolvedReports = reports.filter((report) => report.status === "resolved");

  return (
    <>
      <header className="border-b border-[#181713]/15 bg-[#f3efe6] px-5 py-4 text-[#181713] sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-[-0.04em]">Fiakto.</Link>
          <nav className="flex items-center gap-4 text-sm font-bold">
            <Link href="/admin/pagos" className="underline">Pagos</Link>
            <button type="button" onClick={handleLogout} className="underline">
              Cerrar sesión
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10 text-[#181713] sm:px-8">
        <h1 className="mb-6 text-2xl font-bold">Disputas</h1>

        {error && (
          <p role="alert" className="mb-4 text-sm font-semibold text-[#b52f1c]">
            {error}
          </p>
        )}

        <h2 className="mb-3 text-lg font-semibold">Abiertas ({openReports.length})</h2>
        {openReports.length === 0 ? (
          <p className="mb-8 text-[#777166]">No hay disputas abiertas.</p>
        ) : (
          <ul className="mb-10 flex flex-col gap-4">
            {openReports.map((report) => (
              <li key={report.id} className="border border-[#181713]/20 bg-[#fffdf8] p-5">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold">
                    Reportado por {REPORTER_LABEL[report.reporterRole]}
                  </span>
                  <span className="w-fit rounded-full border border-[#181713]/20 px-3 py-1 text-xs font-semibold">
                    {report.request?.status ?? "solicitud eliminada"}
                  </span>
                </div>
                <p className="mb-2 text-sm text-[#777166]">
                  {report.request
                    ? `${report.request.description} — ${report.request.locality}, ${report.request.province}`
                    : "Esta solicitud ya no existe."}
                </p>
                <p className="mb-4 text-sm font-semibold">{report.reason}</p>
                <form onSubmit={(event) => handleResolve(report.id, event)} className="flex flex-col gap-2">
                  <textarea
                    aria-label="Nota de resolución"
                    required
                    minLength={1}
                    rows={2}
                    placeholder="¿Cómo se resolvió?"
                    value={notes[report.id] ?? ""}
                    onChange={(event) =>
                      setNotes((current) => ({ ...current, [report.id]: event.target.value }))
                    }
                    className="w-full resize-y border border-[#181713]/30 bg-transparent px-3 py-2 text-sm outline-none focus:border-[#dc4b2f]"
                  />
                  <button
                    type="submit"
                    disabled={resolving === report.id}
                    className="w-fit bg-[#181713] px-4 py-2 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {resolving === report.id ? "Resolviendo…" : "Marcar como resuelto"}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mb-3 text-lg font-semibold">Resueltas ({resolvedReports.length})</h2>
        {resolvedReports.length === 0 ? (
          <p className="text-[#777166]">Todavía no se resolvió ninguna disputa.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {resolvedReports.map((report) => (
              <li key={report.id} className="border border-[#181713]/10 p-5">
                <p className="mb-1 text-sm font-bold">{REPORTER_LABEL[report.reporterRole]}: {report.reason}</p>
                <p className="text-sm text-[#565249]">Resolución: {report.resolutionNote}</p>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
