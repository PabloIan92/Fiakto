import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

vi.mock("@/app/providers/AuthProvider", () => ({
  useRoleGuard: () => ({ ready: true }),
}));

import NewRequestPage from "@/app/cliente/solicitudes/nueva/page";

describe("customer request form", () => {
  it("offers the required accessible fields and primary action", () => {
    render(<NewRequestPage />);

    expect(screen.getByLabelText("¿Qué necesitás resolver?")).toBeTruthy();
    expect(screen.getByLabelText("Provincia")).toBeTruthy();
    expect(screen.getByLabelText("Localidad")).toBeTruthy();
    expect(screen.getByLabelText("Fotos, video o audio (opcional)")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Analizar solicitud" })).toBeTruthy();
  });

  it("does not request a street address", () => {
    render(<NewRequestPage />);

    expect(screen.queryByLabelText(/dirección|domicilio|calle/i)).toBeNull();
  });
});
