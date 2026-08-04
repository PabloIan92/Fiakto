import { getAuth } from "firebase-admin/auth";

export type Actor = {
  id: string;
  role: "customer" | "professional" | "admin";
};

function bearerToken(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);

  const session = request.headers
    .get("cookie")
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith("__session="));
  return session ? decodeURIComponent(session.slice("__session=".length)) : null;
}

export async function authenticateRequest(request: Request): Promise<Actor | null> {
  const token = bearerToken(request);
  if (!token) return null;

  try {
    const decoded = await getAuth().verifyIdToken(token);
    const role = decoded.role;
    if (role !== "customer" && role !== "professional" && role !== "admin") {
      return null;
    }
    return { id: decoded.uid, role };
  } catch {
    return null;
  }
}
