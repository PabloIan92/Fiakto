export type DecodedToken = {
  uid: string;
  role?: "customer" | "professional" | "admin";
};

export type Dependencies = {
  verifyIdToken(idToken: string): Promise<DecodedToken>;
  setActiveRole(uid: string, role: "customer" | "professional"): Promise<void>;
};

const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 días: "recordar sesión"

export function createSessionPostHandler(dependencies: Dependencies) {
  return async function POST(request: Request) {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const idToken = (body as { idToken?: unknown })?.idToken;
    if (typeof idToken !== "string" || idToken.length === 0) {
      return Response.json({ error: "Missing idToken" }, { status: 400 });
    }
    const requestedRoleRaw = (body as { requestedRole?: unknown })?.requestedRole;
    const requestedRole =
      requestedRoleRaw === "customer" || requestedRoleRaw === "professional"
        ? requestedRoleRaw
        : undefined;

    let decoded: DecodedToken;
    try {
      decoded = await dependencies.verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    // El rol se elige en cada login/alta, no es fijo por cuenta: si el rol
    // pedido para esta sesión no coincide con el que trae el idToken
    // (porque nunca se asignó, o porque la sesión anterior era del otro
    // rol), hay que asignarlo y pedirle al cliente que refresque el token
    // antes de armar la cookie de sesión. Un admin es la excepción: su rol
    // no se elige en el selector de /login (no hay botón para eso), así
    // que un idToken viejo que todavía dice "customer"/"professional" de
    // una sesión anterior no debe pisar el claim admin ya asignado.
    if (requestedRole && decoded.role !== requestedRole && decoded.role !== "admin") {
      await dependencies.setActiveRole(decoded.uid, requestedRole);
      return Response.json({ needsRefresh: true });
    }

    if (!decoded.role) {
      return Response.json({ error: "No role selected" }, { status: 400 });
    }

    const cookie = [
      `__session=${idToken}`,
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      `Max-Age=${SESSION_MAX_AGE_SECONDS}`,
      ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
    ].join("; ");

    return Response.json(
      { needsRefresh: false, role: decoded.role },
      { headers: { "Set-Cookie": cookie } },
    );
  };
}

export function createSessionDeleteHandler() {
  return async function DELETE() {
    const cookie = [
      "__session=",
      "Path=/",
      "HttpOnly",
      "SameSite=Lax",
      "Max-Age=0",
      ...(process.env.NODE_ENV === "production" ? ["Secure"] : []),
    ].join("; ");
    return Response.json({ ok: true }, { headers: { "Set-Cookie": cookie } });
  };
}
