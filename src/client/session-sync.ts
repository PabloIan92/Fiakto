export type SessionSyncResult = { ok: boolean; needsRefresh: boolean };

export async function syncSession(
  idToken: string,
  fetchImpl: typeof fetch = fetch,
  requestedRole?: "customer" | "professional",
): Promise<SessionSyncResult> {
  const response = await fetchImpl("/api/session", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ idToken, requestedRole }),
    credentials: "include",
  });
  if (!response.ok) return { ok: false, needsRefresh: false };
  const data = (await response.json()) as { needsRefresh?: boolean };
  return { ok: true, needsRefresh: Boolean(data.needsRefresh) };
}

type TokenSource = {
  getIdToken(forceRefresh?: boolean): Promise<string>;
};

const MAX_SYNC_ATTEMPTS = 5;

// Justo despues de que el servidor asigna el rol elegido (setActiveRole,
// disparado por el primer syncSession con needsRefresh:true), el custom
// claim puede no estar todavia disponible la primera vez que el cliente
// refresca el idToken: setCustomUserClaims no propaga siempre a tiempo
// para el proximo refresh. Sin reintentos, ese refresh "viejo" hace que
// /api/session devuelva 400 sin fijar la cookie __session, y el login
// termina redirigiendo sin ninguna sesion activa (401 en la primera
// pantalla). Reintentamos el ciclo refresh+sync unas pocas veces con
// backoff creciente antes de dar por perdido el login.
export async function syncSessionUntilReady(
  user: TokenSource,
  requestedRole: "customer" | "professional",
  fetchImpl: typeof fetch = fetch,
  wait: (ms: number) => Promise<void> = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
): Promise<boolean> {
  let token = await user.getIdToken();
  let result = await syncSession(token, fetchImpl, requestedRole);

  for (let attempt = 0; !result.ok || result.needsRefresh; attempt++) {
    if (attempt >= MAX_SYNC_ATTEMPTS) return false;
    await wait(250 * (attempt + 1));
    token = await user.getIdToken(true);
    result = await syncSession(token, fetchImpl);
  }

  return true;
}

export async function clearSession(fetchImpl: typeof fetch = fetch): Promise<void> {
  await fetchImpl("/api/session", { method: "DELETE", credentials: "include" });
}
