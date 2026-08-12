import { describe, expect, it } from "vitest";

import type { UserProfile } from "@/src/domain/profile";
import {
  createProfileGetHandler,
  createProfilePutHandler,
} from "@/app/api/profile/handler";

const FIXED_NOW = new Date("2026-06-15T00:00:00Z");
const ADULT_BIRTH_DATE = "2000-01-01";

function dependencies(actor: { id: string; role: "customer" | "professional" | "admin" } | null) {
  const stored = new Map<string, UserProfile>();
  const key = (userId: string, role: string) => `${userId}_${role}`;
  return {
    stored,
    deps: {
      authenticate: async () => actor,
      repository: {
        get: async (userId: string, role: "customer" | "professional" | "admin") =>
          stored.get(key(userId, role)) ?? null,
        upsert: async (profile: UserProfile) => {
          stored.set(key(profile.userId, profile.role), profile);
        },
        setPhotoPath: async () => undefined,
      },
      now: () => FIXED_NOW,
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
          birthDate: ADULT_BIRTH_DATE,
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
    expect(stored.get("customer-1_customer")?.phone).toBe("+54 11 5555-5555");
    expect(stored.get("customer-1_customer")?.trades).toEqual([]);
  });

  it("saves trades for a professional", async () => {
    const { deps, stored } = dependencies({ id: "pro-1", role: "professional" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({
          phone: "123456",
          birthDate: ADULT_BIRTH_DATE,
          trades: ["cerrajeria", "plomeria"],
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(stored.get("pro-1_professional")?.trades).toEqual(["cerrajeria", "plomeria"]);
  });

  it("rejects an invalid phone", async () => {
    const { deps } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ phone: "a", birthDate: ADULT_BIRTH_DATE }),
      }),
    );
    expect(response.status).toBe(400);
  });

  it("rejects saving without a birth date", async () => {
    const { deps, stored } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ phone: "123456" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Falta la fecha de nacimiento" });
    expect(stored.has("customer-1_customer")).toBe(false);
  });

  it("treats an empty birth date string the same as a missing one", async () => {
    const { deps, stored } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        body: JSON.stringify({ phone: "123456", birthDate: "" }),
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ error: "Falta la fecha de nacimiento" });
    expect(stored.has("customer-1_customer")).toBe(false);
  });

  it("blocks someone under 18 and does not persist the profile", async () => {
    const { deps, stored } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        // FIXED_NOW is 2026-06-15; this birth date makes them 17.
        body: JSON.stringify({ phone: "123456", birthDate: "2008-08-10" }),
      }),
    );

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toMatchObject({ minorBlocked: true });
    expect(stored.has("customer-1_customer")).toBe(false);
  });

  it("allows someone who turns 18 exactly today", async () => {
    const { deps, stored } = dependencies({ id: "customer-1", role: "customer" });
    const response = await createProfilePutHandler(deps)(
      new Request("http://localhost/api/profile", {
        method: "PUT",
        // FIXED_NOW is 2026-06-15; this birth date makes them exactly 18 today.
        body: JSON.stringify({ phone: "123456", birthDate: "2008-06-15" }),
      }),
    );

    expect(response.status).toBe(200);
    expect(stored.get("customer-1_customer")?.birthDate).toBe("2008-06-15");
  });
});
