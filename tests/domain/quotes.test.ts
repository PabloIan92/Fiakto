import { describe, expect, it } from "vitest";

import { canProfessionalViewRequest } from "@/src/domain/quotes";

describe("private opportunity matching", () => {
  it("requires matching trade, coverage and verified identity", () => {
    expect(
      canProfessionalViewRequest(
        { trade: "plomeria", province: "Buenos Aires", locality: "Lanús" },
        { verified: true, hasPhoto: true, trades: ["plomeria"], coverage: ["Lanús"] },
      ),
    ).toBe(true);
    expect(
      canProfessionalViewRequest(
        { trade: "gas", province: "Buenos Aires", locality: "Lanús" },
        { verified: true, hasPhoto: true, trades: ["plomeria"], coverage: ["Lanús"] },
      ),
    ).toBe(false);
  });

  it("matches coverage regardless of case, accents or surrounding whitespace", () => {
    expect(
      canProfessionalViewRequest(
        { trade: "plomeria", province: "Buenos Aires", locality: "San Isidro" },
        { verified: true, hasPhoto: true, trades: ["plomeria"], coverage: [" san isidro "] },
      ),
    ).toBe(true);
    expect(
      canProfessionalViewRequest(
        { trade: "plomeria", province: "Córdoba", locality: "Córdoba" },
        { verified: true, hasPhoto: true, trades: ["plomeria"], coverage: ["CORDOBA"] },
      ),
    ).toBe(true);
    expect(
      canProfessionalViewRequest(
        { trade: "plomeria", province: "Buenos Aires", locality: "Lanús" },
        { verified: true, hasPhoto: true, trades: ["plomeria"], coverage: ["Lomas de Zamora"] },
      ),
    ).toBe(false);
  });

  it("requires a profile photo, even if trade/coverage/verified all match", () => {
    expect(
      canProfessionalViewRequest(
        { trade: "plomeria", province: "Buenos Aires", locality: "Lanús" },
        { verified: true, hasPhoto: false, trades: ["plomeria"], coverage: ["Lanús"] },
      ),
    ).toBe(false);
  });
});
