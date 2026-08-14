import { describe, expect, it } from "vitest";

import { redactContactInfo } from "@/src/domain/messages";

describe("redactContactInfo", () => {
  it("redacts an email address", () => {
    const { text, redacted } = redactContactInfo("Escribime a pablo@gmail.com para coordinar.");
    expect(text).toBe("Escribime a [contacto oculto] para coordinar.");
    expect(redacted).toBe(true);
  });

  it("redacts a phone number with separators", () => {
    const { text, redacted } = redactContactInfo("Llamame al 11 5555-5555 mejor.");
    expect(text).toBe("Llamame al [contacto oculto] mejor.");
    expect(redacted).toBe(true);
  });

  it("redacts a phone number typed as one continuous block", () => {
    const { text, redacted } = redactContactInfo("mi whatsapp es 1155555555");
    expect(text).toBe("mi whatsapp es [contacto oculto]");
    expect(redacted).toBe(true);
  });

  it("does not redact a peso amount mentioned in the chat", () => {
    const { text, redacted } = redactContactInfo("El presupuesto te sale 150000 pesos");
    expect(text).toBe("El presupuesto te sale 150000 pesos");
    expect(redacted).toBe(false);
  });

  it("leaves ordinary text untouched", () => {
    const { text, redacted } = redactContactInfo("Puedo pasar mañana a la tarde, ¿te sirve?");
    expect(text).toBe("Puedo pasar mañana a la tarde, ¿te sirve?");
    expect(redacted).toBe(false);
  });
});
