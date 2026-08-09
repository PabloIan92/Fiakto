export type SessionSyncResult = { needsRefresh: boolean };

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
  if (!response.ok) return { needsRefresh: false };
  const data = (await response.json()) as { needsRefresh?: boolean };
  return { needsRefresh: Boolean(data.needsRefresh) };
}

export async function clearSession(fetchImpl: typeof fetch = fetch): Promise<void> {
  await fetchImpl("/api/session", { method: "DELETE", credentials: "include" });
}
