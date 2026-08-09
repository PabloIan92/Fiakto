import { describe, expect, it } from "vitest";

import {
  createSessionDeleteHandler,
  createSessionPostHandler,
  type DecodedToken,
} from "@/app/api/session/handler";

function dependencies(decoded: DecodedToken | null) {
  const rolesAssigned: Array<{ uid: string; role: string }> = [];
  return {
    rolesAssigned,
    deps: {
      verifyIdToken: async (idToken: string) => {
        if (!decoded || idToken !== "valid-token") throw new Error("invalid");
        return decoded;
      },
      setActiveRole: async (uid: string, role: "customer" | "professional") => {
        rolesAssigned.push({ uid, role });
      },
    },
  };
}

describe("POST /api/session", () => {
  it("returns 400 without an idToken", async () => {
    const { deps } = dependencies({ uid: "user-1", role: "customer" });
    const response = await createSessionPostHandler(deps)(
      new Request("http://localhost/api/session", { method: "POST", body: "{}" }),
    );
    expect(response.status).toBe(400);
  });

  it("returns 401 for an invalid token", async () => {
    const { deps } = dependencies(null);
    const response = await createSessionPostHandler(deps)(
      new Request("http://localhost/api/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "bad-token" }),
      }),
    );
    expect(response.status).toBe(401);
  });

  it("assigns the requested role and asks the client to refresh on first login", async () => {
    const { deps, rolesAssigned } = dependencies({ uid: "user-1" });
    const response = await createSessionPostHandler(deps)(
      new Request("http://localhost/api/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "valid-token", requestedRole: "professional" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ needsRefresh: true });
    expect(rolesAssigned).toEqual([{ uid: "user-1", role: "professional" }]);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("switches the active role when it differs from the one in the token, asking for a refresh", async () => {
    const { deps, rolesAssigned } = dependencies({ uid: "user-1", role: "customer" });
    const response = await createSessionPostHandler(deps)(
      new Request("http://localhost/api/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "valid-token", requestedRole: "professional" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ needsRefresh: true });
    expect(rolesAssigned).toEqual([{ uid: "user-1", role: "professional" }]);
  });

  it("returns an error if there is no role in the token and none was requested", async () => {
    const { deps } = dependencies({ uid: "user-1" });
    const response = await createSessionPostHandler(deps)(
      new Request("http://localhost/api/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "valid-token" }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("sets a long-lived session cookie once the token carries the requested role", async () => {
    const { deps } = dependencies({ uid: "user-1", role: "customer" });
    const response = await createSessionPostHandler(deps)(
      new Request("http://localhost/api/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "valid-token", requestedRole: "customer" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ needsRefresh: false, role: "customer" });
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toContain("__session=valid-token");
    expect(cookie).toMatch(/Max-Age=\d+/);
    expect(cookie).toContain("HttpOnly");
  });
});

describe("DELETE /api/session", () => {
  it("clears the session cookie", async () => {
    const response = await createSessionDeleteHandler()();
    expect(response.headers.get("set-cookie")).toContain("Max-Age=0");
  });
});
