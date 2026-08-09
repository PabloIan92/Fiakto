import type { Actor } from "@/src/server/auth";
import type { RequestRepository } from "@/src/server/repositories/request-repository";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";
import { canProfessionalViewRequest } from "@/src/domain/quotes";

type Context = { params: Promise<{ id: string }> };

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: Pick<RequestRepository, "listByCustomer" | "listOpen" | "listByProfessional">;
  profileRepository: ProfileRepository;
};

export function createRequestGetHandler(dependencies: Dependencies) {
  return async function GET(request: Request, context: Context) {
    const actor = await dependencies.authenticate(request);
    if (!actor) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await context.params;

    if (actor.role === "customer") {
      const own = await dependencies.repository.listByCustomer(actor.id);
      const found = own.find((item) => item.id === id);
      if (!found) return Response.json({ error: "Not found" }, { status: 404 });
      return Response.json(found);
    }

    if (actor.role === "professional") {
      const [open, ownJobs] = await Promise.all([
        dependencies.repository.listOpen(),
        dependencies.repository.listByProfessional(actor.id),
      ]);
      const found = [...open, ...ownJobs].find((item) => item.id === id);
      if (!found) return Response.json({ error: "Not found" }, { status: 404 });

      // Si ya es el profesional asignado (in_progress/completed) no hace
      // falta re-chequear oficio/cobertura: ya se validaron al iniciar el
      // trabajo y la solicitud puede haber salido de "open" desde entonces.
      if (found.professionalId !== actor.id) {
        const profile = await dependencies.profileRepository.get(actor.id);
        const canView = canProfessionalViewRequest(
          {
            trade: found.triage?.trade ?? "",
            province: found.location.province,
            locality: found.location.locality,
          },
          {
            verified: true,
            trades: profile?.trades ?? [],
            coverage: profile?.coverage ?? [],
          },
        );
        if (!canView) return Response.json({ error: "Forbidden" }, { status: 403 });
      }

      // El profesional nunca ve la dirección exacta acá: solo la zona
      // aproximada (lat/lng/displayRadiusKm). La revelación condicional de
      // exactAddress cuando el trabajo se acepta y se paga es un ítem
      // aparte del roadmap (ver README) que todavía no está implementado.
      const location = { ...found.location };
      delete location.exactAddress;
      return Response.json({ ...found, location });
    }

    return Response.json({ error: "Forbidden" }, { status: 403 });
  };
}
