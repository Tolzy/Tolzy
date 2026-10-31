import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Segmented } from "./controls";
import { ColorField } from "./color/color-field";

function SegmentedHarness() {
  const [value, setValue] = useState<"a" | "b">("a");
  return (
    <Segmented
      ariaLabel="Mode"
      value={value}
      onChange={setValue}
      options={[
        { value: "a", label: "Alpha" },
        { value: "b", label: "Beta" },
      ]}
    />
  );
}

describe("Segmented", () => {
  it("selects an option and never deselects the active one", async () => {
    render(<SegmentedHarness />);
    const beta = screen.getByRole("radio", { name: "Beta" });
    await userEvent.click(beta);
    expect(beta).toHaveAttribute("aria-checked", "true");
    await userEvent.click(beta);
    expect(beta).toHaveAttribute("aria-checked", "true");
  });
});

function ColorHarness() {
  const [value, setValue] = useState("#112233");
  return (
    <>
      <ColorField label="Tint" value={value} onChange={setValue} />
      <span data-testid="value">{value}</span>
    </>
  );
}

describe("ColorField", () => {
  it("accepts valid hex and reverts invalid input", async () => {
    render(<ColorHarness />);
    const input = screen.getByLabelText("Tint");
    await userEvent.clear(input);
    await userEvent.type(input, "abcdef{Enter}");
    expect(screen.getByTestId("value")).toHaveTextContent("#abcdef");

    await userEvent.clear(input);
    await userEvent.type(input, "zz{Enter}");
    expect(screen.getByTestId("value")).toHaveTextContent("#abcdef");
    expect(input).toHaveValue("ABCDEF");
  });
});
