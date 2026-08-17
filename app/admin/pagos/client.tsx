"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { useEffect, useState } from "react";

import { useAuth, useRoleGuard } from "@/app/providers/AuthProvider";
import { auth } from "@/src/client/firebase-client";
import { clearSession } from "@/src/client/session-sync";

type AdminPayment = {
  id: string;
  description: string;
  province: string;
  locality: string;
  subtotalArs: number;
  feeArs: number;
  amountArs: number;
  hasReceipt: boolean;
  paymentReceiptUrl?: string;
  paymentReceiptVerdict?: { looksValid: boolean; reason: string };
};

export default function AdminPaymentsPage() {
  const router = useRouter();
  const { user } = useAuth();
  const { ready } = useRoleGuard("admin", "/login");
  const [payments, setPayments] = useState<AdminPayment[]>([]);
  const [status, setStatus] = useState<"loading" | "ok">("loading");
  const [settling, setSettling] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadIndex, setReloadIndex] = useState(0);

  useEffect(() => {
    if (!ready || !user) return;
    (async () => {
      const token = await user.getIdToken();
      const response = await fetch("/api/admin/payments", {
        headers: { authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const body = (await response.json()) as { payments: AdminPayment[] };
        setPayments(body.payments);
      }
      setStatus("ok");
    })();
  }, [ready, user, reloadIndex]);

  async function handleSettle(id: string) {
    if (!user) return;
    setSettling(id);
    setError(null);
    const token = await user.getIdToken();
    const response = await fetch(`/api/admin/payments/${id}/settle`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}` },
    });
    setSettling(null);
    if (!response.ok) {
      setError("No pudimos marcar el pago como liquidado. Probá de nuevo.");
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

  return (
    <>
      <header className="border-b border-[#181713]/15 bg-[#f3efe6] px-5 py-4 text-[#181713] sm:px-8">
        <div className="mx-auto flex max-w-4xl items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-[-0.04em]">Fiakto.</Link>
          <nav className="flex items-center gap-4 text-sm font-bold">
            <Link href="/admin/reportes" className="underline">Disputas</Link>
            <button type="button" onClick={handleLogout} className="underline">
              Cerrar sesión
            </button>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-5 py-10 text-[#181713] sm:px-8">
        <h1 className="mb-2 text-2xl font-bold">Pagos por transferencia pendientes de liquidar</h1>
        <p className="mb-6 max-w-2xl text-sm text-[#777166]">
          El cliente ya transfirió a la cuenta de Fiakto. Verificá el comprobante y marcá "Ya le
          pagué al profesional" recién cuando hiciste esa transferencia de verdad.
        </p>

        {error && (
          <p role="alert" className="mb-4 text-sm font-semibold text-[#b52f1c]">
            {error}
          </p>
        )}

        {payments.length === 0 ? (
          <p className="text-[#777166]">No hay pagos pendientes de liquidar.</p>
        ) : (
          <ul className="flex flex-col gap-4">
            {payments.map((payment) => (
              <li key={payment.id} className="border border-[#181713]/20 bg-[#fffdf8] p-5">
                <p className="mb-1 text-sm text-[#777166]">
                  {payment.locality}, {payment.province}
                </p>
                <p className="mb-3 text-sm">{payment.description}</p>
                <p className="mb-3 text-sm font-bold">
                  Subtotal: ${payment.subtotalArs.toLocaleString("es-AR")} · Comisión Fiakto: $
                  {payment.feeArs.toLocaleString("es-AR")} · Total transferido: $
                  {payment.amountArs.toLocaleString("es-AR")}
                </p>
                <div className="mb-3">
                  {payment.hasReceipt ? (
                    <a
                      href={payment.paymentReceiptUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block text-sm font-bold underline"
                    >
                      Ver comprobante
                    </a>
                  ) : (
                    <p className="text-sm font-semibold text-[#b52f1c]">
                      El cliente todavía no subió el comprobante.
                    </p>
                  )}
                  {payment.paymentReceiptVerdict && !payment.paymentReceiptVerdict.looksValid && (
                    <p className="mt-1 text-xs font-bold text-[#b45f06]">
                      ⚠ Revisar a mano: {payment.paymentReceiptVerdict.reason}
                    </p>
                  )}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => handleSettle(payment.id)}
                    disabled={settling === payment.id || !payment.hasReceipt}
                    className="bg-[#181713] px-4 py-2 text-sm font-black text-white transition disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {settling === payment.id ? "Marcando…" : "Ya le pagué al profesional"}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
