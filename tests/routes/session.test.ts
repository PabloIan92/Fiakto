import { describe, expect, it } from "vitest";

import {
  createSessionDeleteHandler,
  createSessionPostHandler,
  type DecodedToken,
} from "@/app/api/session/handler";

function dependencies(decoded: DecodedToken | null) {
  const rolesAssigned: string[] = [];
  return {
    rolesAssigned,
    deps: {
      verifyIdToken: async (idToken: string) => {
        if (!decoded || idToken !== "valid-token") throw new Error("invalid");
        return decoded;
      },
      ensureDefaultRole: async (uid: string) => {
        rolesAssigned.push(uid);
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

  it("assigns a default customer role and asks the client to refresh on first login", async () => {
    const { deps, rolesAssigned } = dependencies({ uid: "user-1" });
    const response = await createSessionPostHandler(deps)(
      new Request("http://localhost/api/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "valid-token" }),
      }),
    );

    await expect(response.json()).resolves.toEqual({ needsRefresh: true });
    expect(rolesAssigned).toEqual(["user-1"]);
    expect(response.headers.get("set-cookie")).toBeNull();
  });

  it("sets a long-lived session cookie once the token carries a role", async () => {
    const { deps } = dependencies({ uid: "user-1", role: "customer" });
    const response = await createSessionPostHandler(deps)(
      new Request("http://localhost/api/session", {
        method: "POST",
        body: JSON.stringify({ idToken: "valid-token" }),
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
