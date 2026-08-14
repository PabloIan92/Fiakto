import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#f3efe6] text-[#181713]">
      <header className="border-b border-[#181713]/15 px-5 py-4 sm:px-8">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-xl font-black tracking-[-0.04em]">Fiakto.</Link>
          <Link
            href="/login"
            className="rounded-full border border-[#181713]/20 px-3 py-1 text-xs font-semibold transition hover:border-[#181713]/40 hover:bg-[#181713]/5"
          >
            Iniciar sesión
          </Link>
        </div>
      </header>

      <main className="mx-auto flex max-w-5xl flex-col justify-center px-6 py-16">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest">Todo tiene solución.</p>
        <h1 className="text-5xl font-bold tracking-tight">Fiakto</h1>
        <p className="mt-5 max-w-xl text-lg text-neutral-600 dark:text-neutral-300">
          Publicá lo que necesitás y recibí presupuestos privados de profesionales verificados.
        </p>
        <Link href="/impacto" className="mt-6 w-fit text-sm font-bold underline">
          Ver Fiakto en números →
        </Link>
      </main>
    </div>
  );
}
