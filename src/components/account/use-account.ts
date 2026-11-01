"use client";

import { useEffect } from "react";
import { useAccount } from "@/stores/account-store";

/** Loads the app status once per page and returns it (null while loading). */
export function useAppStatus() {
  const status = useAccount((s) => s.status);
  const refresh = useAccount((s) => s.refresh);
  useEffect(() => {
    if (!useAccount.getState().status && !useAccount.getState().loading) void refresh();
  }, [refresh]);
  return status;
}
