import { describe, expect, it } from "vitest";

import { syncSessionUntilReady } from "@/src/client/session-sync";

function fakeUser(tokensByRefresh: Record<string, string>) {
  return {
    getIdToken: async (forceRefresh?: boolean) =>
      forceRefresh ? tokensByRefresh.fresh : tokensByRefresh.initial,
  };
}

function jsonResponse(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status });
}

describe("syncSessionUntilReady", () => {
  it("succeeds immediately when the first sync sets the cookie", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (_url: string, init?: RequestInit) => {
      calls.push(String(init?.body));
      return jsonResponse(200, { needsRefresh: false, role: "customer" });
    }) as typeof fetch;

    const ready = await syncSessionUntilReady(
      fakeUser({ initial: "token-1" }),
      "customer",
      fetchImpl,
      async () => undefined,
    );

    expect(ready).toBe(true);
    expect(calls).toHaveLength(1);
  });

  it("retries after a custom-claim propagation delay (needsRefresh, then a stale 400) before succeeding", async () => {
    let call = 0;
    const fetchImpl = (async () => {
      call += 1;
      if (call === 1) return jsonResponse(200, { needsRefresh: true });
      // El primer refresh todavia no ve el claim recien asignado: el
      // servidor devuelve 400 sin fijar la cookie.
      if (call === 2) return jsonResponse(400, { error: "No role selected" });
      return jsonResponse(200, { needsRefresh: false, role: "customer" });
    }) as typeof fetch;

    const waits: number[] = [];
    const ready = await syncSessionUntilReady(
      fakeUser({ initial: "token-1", fresh: "token-2" }),
      "customer",
      fetchImpl,
      async (ms) => {
        waits.push(ms);
      },
    );

    expect(ready).toBe(true);
    expect(call).toBe(3);
    expect(waits).toEqual([250, 500]);
  });

  it("gives up after the maximum number of attempts instead of retrying forever", async () => {
    const fetchImpl = (async () => jsonResponse(400, { error: "No role selected" })) as typeof fetch;

    const ready = await syncSessionUntilReady(
      fakeUser({ initial: "token-1", fresh: "token-1" }),
      "customer",
      fetchImpl,
      async () => undefined,
    );

    expect(ready).toBe(false);
  });
});
