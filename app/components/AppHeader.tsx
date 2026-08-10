"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";

import { auth } from "@/src/client/firebase-client";
import { clearSession } from "@/src/client/session-sync";

// Unico lugar de la app con un link a /perfil: antes no habia ninguno, asi
// que una vez logueado no habia forma de llegar a editar el perfil salvo
// escribiendo la URL a mano.
export function AppHeader() {
  const router = useRouter();

  async function handleLogout() {
    if (auth) await signOut(auth);
    await clearSession();
    router.push("/login");
  }

  return (
    <header className="border-b border-[#181713]/15 bg-[#f3efe6] px-5 py-4 text-[#181713] sm:px-8">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link href="/" className="text-xl font-black tracking-[-0.04em]">Fiakto.</Link>
        <nav className="flex items-center gap-4 text-sm font-bold">
          <Link href="/perfil" className="underline">Mi perfil</Link>
          <button type="button" onClick={handleLogout} className="underline">
            Cerrar sesión
          </button>
        </nav>
      </div>
    </header>
  );
}
