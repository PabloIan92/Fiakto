import type { Actor } from "@/src/server/auth";

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  setProfessionalRole(userId: string): Promise<void>;
};

export function createBecomeProfessionalHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (actor.role === "professional") {
      return Response.json({ needsRefresh: false });
    }

    await dependencies.setProfessionalRole(actor.id);
    // El custom claim recién queda disponible en el próximo ID token: el
    // cliente tiene que forzar un refresh (getIdToken(true)) y volver a
    // sincronizar la sesión con /api/session.
    return Response.json({ needsRefresh: true });
  };
}
