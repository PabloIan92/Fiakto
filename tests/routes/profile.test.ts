import { describe, expect, it } from "vitest";

import type { UserProfile } from "@/src/domain/profile";
import {
  createProfileGetHandler,
  createProfilePutHandler,
} from "@/app/api/profile/handler";

function dependencies(actor: { id: string; role: "customer" | "professional" | "admin" } | null) {
  const stored = new Map<string, UserProfile>();
  return {
    stored,
    deps: {
      authenticate: async () => actor,
      repository: {
        get: async (userId: string) => stored.get(userId) ?? null,
        upsert: async (profile: UserProfile) => {
          stored.set(profile.userId, profile);
        },
      },
    },
  };
}

describe("GET /api/profile", () => {
  it("returns 401 without an authenticated session", async () => {
    const { deps } = dependencies(null);
    const response = await createProfileGetHandler(deps)(new Request("http://localhost/api/profile"));
    expect(response.status).toBe(401);
  });

  it("returns an empty default profile when none exists yet", async () => {
    const { deps } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createProfileGetHandler(deps)(new Request("http://localhost/api/profile"));
    await expect(response.json()).resolves.toMatchObject({
      userId: "customer-1",
      role: "customer",
      phone: "",
      trades: [],
    });
  });
});

describe("PUT /api/profile", () => {
  it("returns 401 without an authenticated session", async () => {
    const { deps } = dependencies(null);
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", { method: "PUT", body: "{}" }),
    );
    expect(response.status).toBe(401);
  });

  it("saves phone and location for a customer, ignoring any submitted trades", async () => {
    const { deps, stored } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          phone: "+54 11 5555-5555",
          trades: ["plomeria"],
          location: {
            lat: -34.6,
            lng: -58.4,
            province: "Buenos Aires",
            locality: "Lanús",
            exactAddress: "Calle Falsa 123",
          },
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(stored.get("customer-1")?.phone).toBe("+54 11 5555-5555");
    expect(stored.get("customer-1")?.trades).toEqual([]);
  });

  it("saves trades for a professional", async () => {
    const { deps, stored } = dependencies({ id: "pro-1", role: "professional" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ phone: "123456", trades: ["cerrajeria", "plomeria"] }),
      }),
    );

    expect(response.status).toBe(200);
    expect(stored.get("pro-1")?.trades).toEqual(["cerrajeria", "plomeria"]);
  });

  it("rejects an invalid phone", async () => {
    const { deps } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ phone: "a" }),
      }),
    );
    expect(response.status).toBe(400);
  });
});
