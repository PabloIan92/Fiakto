"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  type User,
} from "firebase/auth";

import { auth } from "@/src/client/firebase-client";
import { syncSessionUntilReady } from "@/src/client/session-sync";
import { beginManagedLogin, endManagedLogin } from "@/src/client/pending-role";

const ROLE_HOME: Record<"customer" | "professional" | "admin", string> = {
  customer: "/cliente/solicitudes",
  professional: "/profesional/oportunidades",
  admin: "/admin/reportes",
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [chosenRole, setChosenRole] = useState<"customer" | "professional" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Comun a email/password y Google: una vez que Firebase confirma el login,
  // sincroniza el rol elegido para esta sesion y redirige segun corresponda.
  async function syncSessionAndRedirect(user: User, requestedRole: "customer" | "professional") {
    const ready = await syncSessionUntilReady(user, requestedRole);
    endManagedLogin();
    if (!ready) {
      setError("No pudimos confirmar tu sesión. Volvé a intentar en unos segundos.");
      return;
    }

    const tokenResult = await user.getIdTokenResult(true);
    const role = tokenResult.claims.role;
    const destination =
      role === "customer" || role === "professional" || role === "admin"
        ? ROLE_HOME[role]
        : "/cliente/solicitudes";
    router.push(destination);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (!chosenRole) {
      setError("Elegí si querés entrar como cliente o como profesional.");
      return;
    }

    setSubmitting(true);
    try {
      if (!auth) {
        setError("Firebase no está configurado en este entorno todavía.");
        return;
      }

      beginManagedLogin();

      if (mode === "signup") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }

      const user = auth.currentUser;
      if (!user) throw new Error("No se pudo obtener el usuario recién autenticado.");
      await syncSessionAndRedirect(user, chosenRole);
    } catch {
      endManagedLogin();
      setError("No pudimos iniciar sesión. Revisá el email y la contraseña.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleGoogleSignIn() {
    setError(null);

    if (!chosenRole) {
      setError("Elegí si querés entrar como cliente o como profesional.");
      return;
    }

    setSubmitting(true);
    try {
      if (!auth) {
        setError("Firebase no está configurado en este entorno todavía.");
        return;
      }

      beginManagedLogin();
      const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
      await syncSessionAndRedirect(user, chosenRole);
    } catch {
      endManagedLogin();
      setError("No pudimos iniciar sesión con Google.");
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
            <div>
              <span className="mb-2 block text-sm font-bold">
                {mode === "signup" ? "¿Cómo querés registrarte?" : "¿Cómo querés entrar?"}
              </span>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  aria-pressed={chosenRole === "customer"}
                  onClick={() => setChosenRole("customer")}
                  className={`border px-4 py-3 text-left text-sm font-bold transition ${
                    chosenRole === "customer"
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
                  aria-pressed={chosenRole === "professional"}
                  onClick={() => setChosenRole("professional")}
                  className={`border px-4 py-3 text-left text-sm font-bold transition ${
                    chosenRole === "professional"
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
                Podés usar el mismo email para las dos cosas: elegís con cuál entrar cada vez que
                iniciás sesión.
              </p>
            </div>
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
              disabled={submitting || !chosenRole}
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

        <div className="mt-4 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-[#777166]">
          <span className="h-px flex-1 bg-[#181713]/15" />
          o
          <span className="h-px flex-1 bg-[#181713]/15" />
        </div>

        <button
          type="button"
          onClick={handleGoogleSignIn}
          disabled={submitting || !chosenRole}
          className="mt-4 flex w-full items-center justify-center gap-3 border border-[#181713]/20 bg-[#fffdf8] px-6 py-3 text-sm font-bold transition hover:border-[#181713]/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
            <path
              fill="#4285F4"
              d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v2.98h3.86c2.26-2.08 3.56-5.14 3.56-8.8Z"
            />
            <path
              fill="#34A853"
              d="M12 24c3.24 0 5.95-1.08 7.93-2.92l-3.86-2.98c-1.07.72-2.45 1.15-4.07 1.15-3.13 0-5.78-2.11-6.73-4.96H1.28v3.09C3.26 21.3 7.31 24 12 24Z"
            />
            <path
              fill="#FBBC05"
              d="M5.27 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62H1.28A11.95 11.95 0 0 0 0 12c0 1.93.46 3.76 1.28 5.38l3.99-3.09Z"
            />
            <path
              fill="#EA4335"
              d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.42-3.42C17.94 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.28 6.62l3.99 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
            />
          </svg>
          Continuar con Google
        </button>

        <button
          type="button"
          className="mt-6 w-fit text-sm font-bold underline"
          onClick={() => {
            setMode(mode === "signup" ? "signin" : "signup");
          }}
        >
          {mode === "signup" ? "Ya tengo cuenta" : "Crear una cuenta nueva"}
        </button>
      </div>
    </main>
  );
}
