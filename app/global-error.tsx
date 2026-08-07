"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="es-AR">
      <body className="min-h-full flex flex-col items-center justify-center gap-4 p-8 text-center">
        <h1 className="text-xl font-semibold">Algo salió mal</h1>
        <p className="text-sm text-neutral-500">
          Ocurrió un error inesperado. Podés intentar de nuevo.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          className="rounded-md bg-neutral-900 px-4 py-2 text-sm text-white"
        >
          Reintentar
        </button>
      </body>
    </html>
  );
}
