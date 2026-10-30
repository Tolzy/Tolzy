"use client";

import { useEffect, useSyncExternalStore } from "react";
import {
  DEFAULT_THEME,
  THEME_STORAGE_KEY,
  parseThemePreference,
  resolveTheme,
  type ThemePreference,
} from "@/lib/theme";

const EVENT = "ps-theme-change";
const LIGHT_QUERY = "(prefers-color-scheme: light)";

function readPreference(): ThemePreference {
  try {
    return parseThemePreference(localStorage.getItem(THEME_STORAGE_KEY));
  } catch {
    return DEFAULT_THEME;
  }
}

function apply(pref: ThemePreference) {
  document.documentElement.dataset.theme = resolveTheme(pref, window.matchMedia(LIGHT_QUERY).matches);
}

function subscribe(cb: () => void) {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb); // other tabs
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

export function setThemePreference(pref: ThemePreference) {
  try {
    localStorage.setItem(THEME_STORAGE_KEY, pref);
  } catch {
    // Storage unavailable (private mode): still apply for this page view.
  }
  apply(pref);
  window.dispatchEvent(new Event(EVENT));
}

/** Current theme preference ("dark" during server render). */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, readPreference, () => DEFAULT_THEME);
}

/** Keeps the page in sync with other tabs and, for "system", with the OS setting. */
export function ThemeSync() {
  const pref = useThemePreference();
  useEffect(() => {
    apply(pref);
    if (pref !== "system") return;
    const mq = window.matchMedia(LIGHT_QUERY);
    const onChange = () => apply("system");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);
  return null;
}
