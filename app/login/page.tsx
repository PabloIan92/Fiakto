"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";

import { auth } from "@/src/client/firebase-client";
import { syncSession } from "@/src/client/session-sync";
import { setPendingSignupRole, clearPendingSignupRole } from "@/src/client/pending-role";

const ROLE_HOME: Record<"customer" | "professional" | "admin", string> = {
  customer: "/cliente/solicitudes",
  professional: "/profesional/oportunidades",
  admin: "/cliente/solicitudes",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [signupRole, setSignupRole] = useState<"customer" | "professional" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (mode === "signup" && !signupRole) {
      setError("Elegí si querés una cuenta de cliente o de profesional.");
      return;
    }

    setSubmitting(true);
    try {
      if (!auth) {
        setError("Firebase no está configurado en este entorno todavía.");
        return;
      }

      setPendingSignupRole(mode === "signup" ? signupRole! : undefined);

      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      const user = auth.currentUser;
      if (!user) throw new Error("No se pudo obtener el usuario recién autenticado.");

      let token = await user.getIdToken();
      const { needsRefresh } = await syncSession(
        token,
        fetch,
        mode === "signup" ? signupRole! : undefined,
      );
      if (needsRefresh) {
        token = await user.getIdToken(true);
        await syncSession(token);
      }
      clearPendingSignupRole();

      const tokenResult = await user.getIdTokenResult(true);
      const role = tokenResult.claims.role;
      const destination =
        role === "customer" || role === "professional" || role === "admin"
          ? ROLE_HOME[role]
          : "/cliente/solicitudes";
      router.push(destination);
    } catch {
      clearPendingSignupRole();
      setError("No pudimos iniciar sesión. Revisá el email y la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#f3efe6] text-[#181713]">
      <header className="border-b border-[#181713]/15 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-[-0.04em]">Fiakto.</Link>
          <span className="rounded-full border border-[#181713]/20 px-3 py-1 text-xs font-semibold">
            Acceso protegido
          </span>
        </div>
      </header>

      <div className="mx-auto flex max-w-md flex-col justify-center px-5 py-16 sm:px-8">
        <p className="mb-5 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#dc4b2f]">
          {mode === "signup" ? "Alta / 01" : "Acceso / 01"}
        </p>
        <h1 className="mb-8 text-4xl font-black leading-[0.95] tracking-[-0.05em]">
          {mode === "signup" ? "Crear cuenta" : "Iniciar sesión"}
        </h1>

        <form
          onSubmit={handleSubmit}
          className="border border-[#181713]/20 bg-[#fffdf8] p-6 shadow-[8px_8px_0_#181713] sm:p-8"
        >
          <div className="space-y-6">
            {mode === "signup" && (
              <div>
                <span className="mb-2 block text-sm font-bold">Tipo de cuenta</span>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    aria-pressed={signupRole === "customer"}
                    onClick={() => setSignupRole("customer")}
                    className={`border px-4 py-3 text-left text-sm font-bold transition ${
                      signupRole === "customer"
                        ? "border-[#dc4b2f] bg-[#dc4b2f]/10"
                        : "border-[#181713]/20 hover:border-[#181713]/40"
                    }`}
                  >
                    Soy cliente
                    <span className="mt-1 block text-xs font-normal text-[#777166]">
                      Publico lo que necesito
                    </span>
                  </button>
                  <button
                    type="button"
                    aria-pressed={signupRole === "professional"}
                    onClick={() => setSignupRole("professional")}
                    className={`border px-4 py-3 text-left text-sm font-bold transition ${
                      signupRole === "professional"
                        ? "border-[#dc4b2f] bg-[#dc4b2f]/10"
                        : "border-[#181713]/20 hover:border-[#181713]/40"
                    }`}
                  >
                    Soy profesional
                    <span className="mt-1 block text-xs font-normal text-[#777166]">
                      Ofrezco un oficio
                    </span>
                  </button>
                </div>
                <p className="mt-2 text-xs text-[#777166]">
                  Son cuentas separadas: si querés ambas, usá un email distinto para cada una.
                </p>
              </div>
            )}
            <label htmlFor="email" className="block">
              <span className="mb-2 block text-sm font-bold">Email</span>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="h-12 w-full border border-[#181713]/30 bg-transparent px-4 outline-none transition focus:border-[#dc4b2f] focus:ring-2 focus:ring-[#dc4b2f]/20"
              />
            </label>
            <label htmlFor="password" className="block">
              <span className="mb-2 block text-sm font-bold">Contraseña</span>
              <input
                id="password"
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signup" ? "new-password" : "current-password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="h-12 w-full border border-[#181713]/30 bg-transparent px-4 outline-none transition focus:border-[#dc4b2f] focus:ring-2 focus:ring-[#dc4b2f]/20"
              />
            </label>
            {error && (
              <p role="alert" className="text-xs font-bold text-[#b52f1c]">
                {error}
              </p>
            )}
          </div>

          <div className="mt-8 border-t border-[#181713]/15 pt-6">
            <button
              type="submit"
              disabled={submitting || (mode === "signup" && !signupRole)}
              className="w-full bg-[#dc4b2f] px-6 py-4 text-base font-black text-white transition hover:bg-[#bd351f] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting
                ? "Un momento…"
                : mode === "signup"
                  ? "Crear cuenta"
                  : "Iniciar sesión"}
            </button>
          </div>
        </form>

        <button
          type="button"
          className="mt-6 w-fit text-sm font-bold underline"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
            setSignupRole(null);
          }}
        >
          {mode === "signup" ? "Ya tengo cuenta" : "Crear una cuenta nueva"}
        </button>
      </div>
    </main>
  );
}
