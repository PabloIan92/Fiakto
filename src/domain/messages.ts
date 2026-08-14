import { z } from "zod";

export const MessageSchema = z.object({
  requestId: z.string().min(1),
  senderId: z.string().min(1),
  senderRole: z.enum(["customer", "professional"]),
  text: z.string().trim().min(1).max(2000),
});

export type Message = z.infer<typeof MessageSchema>;

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
// Cualquier secuencia con al menos 8 dígitos (separados o no por espacios/
// guiones/paréntesis) se trata como posible teléfono. El piso de 8 dígitos
// es deliberado: evita ocultar precios en ARS mencionados en el chat (la
// mayoría tiene 5-7 dígitos), que un profesional/cliente legítimamente
// necesita poder escribir ahí.
const PHONE_CANDIDATE_PATTERN = /\+?\d[\d\s().-]{5,}\d/g;

// Antifuga de contacto: el chat existe para que cliente y profesional NO
// tengan que pasarse el teléfono/email y seguir hablando fuera de Fiakto
// (donde no hay ningún registro ni forma de intervenir en una disputa).
// Es best-effort — un teléfono escrito en palabras ("cinco cinco cinco...")
// no se detecta — pero cubre el caso común de copiar/pegar un número o
// una dirección de email.
export function redactContactInfo(text: string): { text: string; redacted: boolean } {
  let redacted = false;

  let result = text.replace(EMAIL_PATTERN, () => {
    redacted = true;
    return "[contacto oculto]";
  });

  result = result.replace(PHONE_CANDIDATE_PATTERN, (match) => {
    const digitCount = (match.match(/\d/g) ?? []).length;
    if (digitCount < 8) return match;
    redacted = true;
    return "[contacto oculto]";
  });

  return { text: result, redacted };
}
