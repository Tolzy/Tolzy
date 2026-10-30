import { describe, expect, it } from "vitest";
import { DEFAULT_THEME, parseThemePreference, resolveTheme } from "./theme";

describe("theme preference", () => {
  it("defaults to dark", () => {
    expect(DEFAULT_THEME).toBe("dark");
    expect(parseThemePreference(null)).toBe("dark");
    expect(parseThemePreference("purple")).toBe("dark");
  });

  it("resolves system against the OS setting", () => {
    expect(resolveTheme("system", true)).toBe("light");
    expect(resolveTheme("system", false)).toBe("dark");
    expect(resolveTheme("light", false)).toBe("light");
  });
});
