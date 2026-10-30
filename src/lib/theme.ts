/**
 * Theme preference. Dark is the default; users can choose light or follow the
 * operating system. Stored per device in localStorage (synced to the account
 * profile once accounts exist).
 */
export type ThemePreference = "dark" | "light" | "system";
export type ResolvedTheme = "dark" | "light";

export const THEME_STORAGE_KEY = "ps-theme";
export const DEFAULT_THEME: ThemePreference = "dark";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "system" || value === "dark" ? value : DEFAULT_THEME;
}

export function resolveTheme(pref: ThemePreference, systemPrefersLight: boolean): ResolvedTheme {
  if (pref === "system") return systemPrefersLight ? "light" : "dark";
  return pref;
}

/**
 * Runs in <head> before first paint so the page never flashes the wrong theme.
 * Kept tiny and dependency-free; mirrors parseThemePreference + resolveTheme.
 */
export const THEME_INIT_SCRIPT = `(function(){var d=document.documentElement;try{var p=localStorage.getItem("${THEME_STORAGE_KEY}");if(p!=="light"&&p!=="system")p="dark";d.dataset.theme=p==="system"?(matchMedia("(prefers-color-scheme: light)").matches?"light":"dark"):p}catch(e){d.dataset.theme="dark"}})()`;
