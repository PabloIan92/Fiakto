import { GoogleGenAI } from "@google/genai";

import { PaymentReceiptVerdictSchema } from "@/src/domain/requests";
import type { ReceiptProvider } from "@/src/server/ai/receipt-provider";

interface GeminiClient {
  models: {
    generateContent(request: Record<string, unknown>): Promise<{ text?: string }>;
  };
}

const SYSTEM_INSTRUCTION = `You review a payment transfer receipt (screenshot or photo) for Fiakto, an
Argentine home-services marketplace. Return only JSON with exactly this shape:
{
  "looksValid": boolean,
  "reason": string (10-300 characters, in Spanish, explaining the verdict)
}
Mark looksValid=false if: the image doesn't look like a real bank/wallet transfer receipt, the
transferred amount doesn't match the expected amount (small rounding differences under 1% are
fine), the destination alias/CBU doesn't match the expected one, or the date looks old (more than
a few days before today) or can't be determined. This is advisory only — never invent details you
can't actually see in the image; if something is illegible, say so in "reason" and mark
looksValid=false to be safe.`;

function createGeminiClient(): GeminiClient {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not configured");
  return new GoogleGenAI({ apiKey }) as unknown as GeminiClient;
}

export class GeminiReceiptProvider implements ReceiptProvider {
  constructor(private readonly client: GeminiClient = createGeminiClient()) {}

  async verify(input: {
    photoBase64: string;
    contentType: string;
    expectedAmountArs: number;
    expectedAlias: string;
  }) {
    const response = await this.client.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        { inlineData: { data: input.photoBase64, mimeType: input.contentType } },
        `Expected transferred amount: ARS ${input.expectedAmountArs}. Expected destination alias/CBU: "${input.expectedAlias}".`,
      ],
      config: {
        responseMimeType: "application/json",
        systemInstruction: SYSTEM_INSTRUCTION,
      },
    });

    if (!response.text) throw new Error("Gemini returned an empty receipt-review response");
    return PaymentReceiptVerdictSchema.parse(JSON.parse(response.text));
  }
}
