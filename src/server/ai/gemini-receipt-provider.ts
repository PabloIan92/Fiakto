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
You'll be given BOTH the expected alias and the expected CBU for the destination account — a real
receipt normally shows only ONE of the two (alias for wallet-to-wallet transfers like Ualá/Mercado
Pago, CBU for bank-to-bank transfers), never both. Matching EITHER one is enough to consider the
destination correct; do not flag it invalid just because the alias isn't shown when the CBU
matches, or vice versa.
Mark looksValid=false if: the image doesn't look like a real bank/wallet transfer receipt, the
transferred amount doesn't match the expected amount (small rounding differences under 1% are
fine), neither the alias nor the CBU shown matches what's expected, or the date looks old (more
than a few days before today) or can't be determined. This is advisory only — never invent details
you can't actually see in the image; if something is illegible, say so in "reason" and mark
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
    expectedCbu: string;
  }) {
    const response = await this.client.models.generateContent({
      model: "gemini-flash-latest",
      contents: [
        { inlineData: { data: input.photoBase64, mimeType: input.contentType } },
        `Expected transferred amount: ARS ${input.expectedAmountArs}. Expected destination alias: "${input.expectedAlias}". Expected destination CBU: "${input.expectedCbu}".`,
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
