export type DecodedToken = {
  uid: string;
  role?: "customer" | "professional" | "admin";
};

export type Dependencies = {
  verifyIdToken(idToken: string): Promise<DecodedToken>;
  ensureDefaultRole(uid: string): Promise<void>;
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

    let decoded: DecodedToken;
    try {
      decoded = await dependencies.verifyIdToken(idToken);
    } catch {
      return Response.json({ error: "Invalid token" }, { status: 401 });
    }

    if (!decoded.role) {
      // Primer login de este usuario: le asignamos rol "customer" por
      // defecto. El claim recién se ve reflejado en el próximo ID token,
      // así que le avisamos al cliente que tiene que refrescarlo y
      // reintentar antes de considerar la sesión lista.
      await dependencies.ensureDefaultRole(decoded.uid);
      return Response.json({ needsRefresh: true });
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
