import { describe, expect, it } from "vitest";

import { GeminiTriageProvider } from "@/src/server/ai/gemini-triage-provider";

class FakeGeminiClient {
  lastRequest?: Record<string, unknown>;

  constructor(private readonly responseText: string) {}

  readonly models = {
    generateContent: async (request: Record<string, unknown>) => {
      this.lastRequest = request;
      return { text: this.responseText };
    },
  };
}

const validResponse = JSON.stringify({
  trade: "plomeria",
  summary: "Pérdida probable en una conexión bajo la mesada.",
  questions: ["¿La pérdida continúa al cerrar la llave de paso?"],
  riskLevel: "normal",
  referenceRangeArs: null,
  confidence: 0.82,
});

describe("GeminiTriageProvider", () => {
  it("parses a schema-valid JSON response", async () => {
    const client = new FakeGeminiClient(validResponse);
    const provider = new GeminiTriageProvider(client);

    const result = await provider.triage({
      description: "La canilla pierde agua debajo de la mesada.",
      mediaUrls: [],
    });

    expect(result.trade).toBe("plomeria");
    expect(result.referenceRangeArs).toBeNull();
    expect(client.lastRequest).toMatchObject({ model: "gemini-2.5-flash" });
  });

  it("rejects a response containing an unknown trade", async () => {
    const client = new FakeGeminiClient(
      validResponse.replace('"plomeria"', '"cerrajeria"'),
    );
    const provider = new GeminiTriageProvider(client);

    await expect(
      provider.triage({
        description: "La cerradura de entrada dejó de funcionar.",
        mediaUrls: [],
      }),
    ).rejects.toThrow();
  });

  it("requires JSON output and includes emergency safety boundaries", async () => {
    const client = new FakeGeminiClient(validResponse);
    const provider = new GeminiTriageProvider(client);

    await provider.triage({
      description: "Hay olor intenso cerca de la conexión de gas.",
      mediaUrls: ["https://storage.example/evidence.jpg"],
    });

    expect(client.lastRequest).toMatchObject({
      config: { responseMimeType: "application/json" },
    });
    expect(JSON.stringify(client.lastRequest)).toContain("emergency");
    expect(JSON.stringify(client.lastRequest)).toContain("never invent a price range");
  });
});
