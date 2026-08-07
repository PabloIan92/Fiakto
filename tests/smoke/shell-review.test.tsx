import { render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import Home from "@/app/(public)/page";

describe("Fiakto application shell", () => {
  it("keeps the supporting copy readable in dark mode", () => {
    render(<Home />);
    expect(
      screen.getByText(
        "Publicá lo que necesitás y recibí presupuestos privados de profesionales verificados.",
      ).className,
    ).toContain("dark:text-neutral-300");
  });

  it("declares truthful Spanish application metadata", () => {
    const layout = readFileSync("app/layout.tsx", "utf8");

    expect(layout).toContain('title: "Fiakto"');
    expect(layout).toContain('lang="es-AR"');
    expect(layout).not.toContain("Create Next App");
  });
});
