import { db } from "@/src/server/firebase-admin";

// Página pública (sin login) con métricas agregadas reales, para que
// jueces/usuarios externos puedan verla sin necesitar una cuenta de
// Fiakto. Nunca expone datos de una solicitud puntual (descripción,
// dirección, nombre) — solo conteos y sumas agregadas.
export const dynamic = "force-dynamic";

type RequestDoc = {
  status: string;
  customerId?: string;
  professionalId?: string;
  triage?: unknown;
  payment?: { method: "cash" | "transfer"; feeArs: number; amountArs: number };
  review?: { stars: number; comment?: string };
};

type QuoteDoc = {
  professionalId?: string;
};

async function getMetrics() {
  const [requestsSnapshot, quotesSnapshot] = await Promise.all([
    db.collection("requests").get(),
    db.collection("quotes").get(),
  ]);

  const requests = requestsSnapshot.docs.map((doc) => doc.data() as RequestDoc);
  const quotes = quotesSnapshot.docs.map((doc) => doc.data() as QuoteDoc);

  const customers = new Set<string>();
  const professionalsQuoted = new Set<string>();
  let triaged = 0;
  let accepted = 0;
  let completed = 0;
  let closed = 0;
  let feeArs = 0;
  let amountArs = 0;
  let cashJobs = 0;
  let transferJobs = 0;
  let starsSum = 0;
  let reviewCount = 0;
  const testimonials: Array<{ stars: number; comment: string }> = [];

  for (const item of requests) {
    if (item.customerId) customers.add(item.customerId);
    if (item.triage) triaged += 1;
    if (item.status === "completed" || item.status === "closed") completed += 1;
    if (item.status === "closed") closed += 1;
    if (item.payment) {
      accepted += 1;
      feeArs += item.payment.feeArs ?? 0;
      amountArs += item.payment.amountArs ?? 0;
      if (item.payment.method === "cash") cashJobs += 1;
      if (item.payment.method === "transfer") transferJobs += 1;
    }
    if (item.review) {
      reviewCount += 1;
      starsSum += item.review.stars;
      if (item.review.comment) {
        testimonials.push({ stars: item.review.stars, comment: item.review.comment });
      }
    }
  }

  for (const quote of quotes) {
    if (quote.professionalId) professionalsQuoted.add(quote.professionalId);
  }

  return {
    totalRequests: requests.length,
    triaged,
    quotesSubmitted: quotes.length,
    accepted,
    completed,
    closed,
    feeArs,
    amountArs,
    cashJobs,
    transferJobs,
    uniqueCustomers: customers.size,
    uniqueProfessionalsQuoted: professionalsQuoted.size,
    reviewCount,
    averageStars: reviewCount > 0 ? starsSum / reviewCount : null,
    testimonials,
  };
}

export default async function ImpactoPage() {
  const metrics = await getMetrics();

  return (
    <main className="min-h-screen bg-[#f3efe6] px-5 py-16 text-[#181713] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <p className="mb-3 font-mono text-xs font-bold uppercase tracking-[0.2em] text-[#dc4b2f]">
          Evidencia en vivo
        </p>
        <h1 className="mb-4 text-4xl font-black tracking-[-0.04em]">Fiakto en números</h1>
        <p className="mb-10 max-w-xl text-base leading-7 text-[#565249]">
          Datos reales, tomados en el momento de la base de producción de Fiakto — no son
          proyecciones. Cada solicitud pasa por un análisis real con Gemini antes de publicarse, y
          cada trabajo aceptado registra una comisión real para la plataforma.
        </p>

        <h2 className="mb-4 text-lg font-bold">Actividad en la plataforma</h2>
        <div className="mb-10 grid gap-4 sm:grid-cols-2">
          <Metric label="Solicitudes publicadas" value={metrics.totalRequests} />
          <Metric label="Analizadas con Gemini" value={metrics.triaged} />
          <Metric label="Presupuestos enviados por profesionales" value={metrics.quotesSubmitted} />
          <Metric label="Trabajos aceptados y pagados" value={metrics.accepted} />
          <Metric label="Trabajos completados" value={metrics.completed} />
          <Metric label="Trabajos cerrados (aprobados por el cliente)" value={metrics.closed} />
          <Metric label="Clientes únicos" value={metrics.uniqueCustomers} />
          <Metric label="Profesionales que presupuestaron" value={metrics.uniqueProfessionalsQuoted} />
        </div>

        <h2 className="mb-4 text-lg font-bold">Dinero movido a través de la plataforma</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Metric
            label="Monto total transaccionado"
            value={`$${metrics.amountArs.toLocaleString("es-AR")}`}
          />
          <Metric
            label="Comisión Fiakto generada (8%)"
            value={`$${metrics.feeArs.toLocaleString("es-AR")}`}
          />
          <Metric label="Trabajos pagados en efectivo" value={metrics.cashJobs} />
          <Metric label="Trabajos pagados por transferencia" value={metrics.transferJobs} />
        </div>

        {metrics.reviewCount > 0 && (
          <>
            <h2 className="mb-4 mt-10 text-lg font-bold">Testimonios reales</h2>
            <div className="mb-6 grid gap-4 sm:grid-cols-2">
              <Metric label="Calificaciones recibidas" value={metrics.reviewCount} />
              <Metric
                label="Calificación promedio"
                value={metrics.averageStars ? `${metrics.averageStars.toFixed(1)} / 5 ★` : "—"}
              />
            </div>
            {metrics.testimonials.length > 0 && (
              <ul className="flex flex-col gap-3">
                {metrics.testimonials.map((testimonial, index) => (
                  <li key={index} className="border border-[#181713]/15 bg-[#fffdf8] p-4">
                    <p className="mb-1 text-[#dc4b2f]">
                      {"★".repeat(testimonial.stars)}
                      {"☆".repeat(5 - testimonial.stars)}
                    </p>
                    <p className="text-sm text-[#565249]">&ldquo;{testimonial.comment}&rdquo;</p>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="border border-[#181713]/15 bg-[#fffdf8] p-5">
      <p className="text-3xl font-black tracking-[-0.03em]">{value}</p>
      <p className="mt-1 text-sm text-[#777166]">{label}</p>
    </div>
  );
}
