import { describe, expect, it } from "vitest";

import { ServiceRequestSchema } from "@/src/domain/requests";

describe("ServiceRequestSchema", () => {
  it("rejects an empty description and precise public address", () => {
    const result = ServiceRequestSchema.safeParse({
      customerId: "customer-1",
      description: "",
      province: "Buenos Aires",
      locality: "Lanús",
      publicLocation: "Av. Siempre Viva 742",
      media: [],
    });

    expect(result.success).toBe(false);
  });
});
