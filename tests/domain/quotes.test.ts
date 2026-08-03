import { describe, expect, it } from "vitest";

import { canProfessionalViewRequest } from "@/src/domain/quotes";

describe("private opportunity matching", () => {
  it("requires matching trade, coverage and verified identity", () => {
    expect(
      canProfessionalViewRequest(
        { trade: "plomeria", province: "Buenos Aires", locality: "Lanús" },
        { verified: true, trades: ["plomeria"], coverage: ["Lanús"] },
      ),
    ).toBe(true);
    expect(
      canProfessionalViewRequest(
        { trade: "gas", province: "Buenos Aires", locality: "Lanús" },
        { verified: true, trades: ["plomeria"], coverage: ["Lanús"] },
      ),
    ).toBe(false);
  });
});
