import { GoogleGenAI } from "@google/genai";

import { TRADES } from "@/src/domain/profile";
import { TriageResultSchema } from "@/src/domain/triage";
import type { TriageProvider } from "@/src/server/ai/triage-provider";

interface GeminiClient {
  models: {
    generateContent(request: Record<string, unknown>): Promise<{ text?: string }>;
  };
}

const TRADE_ENUM = TRADES.map((trade) => `"${trade}"`).join(" | ");

const SYSTEM_INSTRUCTION = `You triage home-service requests for Fiakto in Argentina.
Return only JSON with exactly this shape:
{
  "trade": ${TRADE_ENUM},
  "summary": string (10-500 characters),
  "questions": string[] (up to 5),
  "riskLevel": "normal" | "urgent" | "emergency",
  "referenceRangeArs": { "min": non-negative number, "max": positive number } | null,
  "confidence": number from 0 to 1
}
Do not diagnose with certainty. Use emergency for visible fire, a suspected gas leak,
exposed live wiring, or structural-collapse cues; never invent a price range when
the evidence is insufficient; return null instead. Suggestions are non-binding.`;

function createGeminiClient(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey }) as unknown as GeminiClient;
}

export class GeminiTriageProvider implements TriageProvider {
  constructor(private readonly client: GeminiClient = createGeminiClient()) {}

  async triage(input: { description: string; mediaUrls: string[] }) {
    const response = await this.client.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        `Customer description: ${input.description}`,
        `Signed media URLs: ${input.mediaUrls.length ? input.mediaUrls.join(", ") : "none"}`,
      ],
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    if (!response.text) throw new Error("Gemini returned an empty triage response");
    return TriageResultSchema.parse(JSON.parse(response.text));
  }
}
