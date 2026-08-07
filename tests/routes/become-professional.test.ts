import { describe, expect, it } from "vitest";

import { createBecomeProfessionalHandler } from "@/app/api/profile/become-professional/handler";

describe("POST /api/profile/become-professional", () => {
  it("returns 401 without an authenticated session", async () => {
    const handler = createBecomeProfessionalHandler({
      authenticate: async () => null,
      setProfessionalRole: async () => undefined,
    });
    const response = await handler(new Request("http://localhost/api/profile/become-professional", { method: "POST" }));
    expect(response.status).toBe(401);
  });

  it("is a no-op and needs no refresh if already professional", async () => {
    const calls: string[] = [];
    const handler = createBecomeProfessionalHandler({
      authenticate: async () => ({ id: "pro-1", role: "professional" }),
      setProfessionalRole: async (userId) => {
        calls.push(userId);
      },
    });
    const response = await handler(new Request("http://localhost/api/profile/become-professional", { method: "POST" }));
    await expect(response.json()).resolves.toEqual({ needsRefresh: false });
    expect(calls).toEqual([]);
  });

  it("grants the professional role and asks for a token refresh", async () => {
    const calls: string[] = [];
    const handler = createBecomeProfessionalHandler({
      authenticate: async () => ({ id: "customer-1", role: "customer" }),
      setProfessionalRole: async (userId) => {
        calls.push(userId);
      },
    });
    const response = await handler(new Request("http://localhost/api/profile/become-professional", { method: "POST" }));
    await expect(response.json()).resolves.toEqual({ needsRefresh: true });
    expect(calls).toEqual(["customer-1"]);
  });
});
