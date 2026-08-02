import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "@/app/(public)/page";

describe("Fiakto home", () => {
  it("states the product promise", () => {
    render(<Home />);
    expect(screen.getByRole("heading", { name: "Fiakto" })).toBeTruthy();
    expect(screen.getByText("Todo tiene solución.")).toBeTruthy();
  });
});
