import { UserProfileSchema } from "@/src/domain/profile";
import type { Actor } from "@/src/server/auth";
import type { ProfileRepository } from "@/src/server/repositories/profile-repository";

export type Dependencies = {
  authenticate(request: Request): Promise<Actor | null>;
  repository: ProfileRepository;
};

export function createProfileGetHandler(dependencies: Dependencies) {
  return async function GET(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const profile = await dependencies.repository.get(actor.id);
    return Response.json(
      profile ?? { userId: actor.id, role: actor.role, phone: "", trades: [], coverage: [] },
    );
  };
}

export function createProfilePutHandler(dependencies: Dependencies) {
  return async function PUT(request: Request) {
    const actor = await dependencies.authenticate(request);
    if (!actor) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = UserProfileSchema.safeParse({
      ...(typeof body === "object" && body !== null ? body : {}),
      userId: actor.id,
      role: actor.role,
      // Solo un profesional puede guardar oficios/cobertura; un cliente los ignora.
      trades: actor.role === "professional"
        ? (body as { trades?: unknown })?.trades ?? []
        : [],
      coverage: actor.role === "professional"
        ? (body as { coverage?: unknown })?.coverage ?? []
        : [],
    });
    if (!parsed.success) {
      return Response.json(
        { error: "Invalid profile", issues: parsed.error.issues },
        { status: 400 },
      );
    }

    await dependencies.repository.upsert(parsed.data);
    return Response.json(parsed.data);
  };
}
