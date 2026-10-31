"use client";

import { createContext, use } from "react";

/** Facts about the model being edited, for panels that need them. */
export interface StudioModel {
  /** Rendered thumbnail of the model (used as the "Original" material preview). */
  thumbnailUrl: string | null;
}

export const StudioModelContext = createContext<StudioModel>({ thumbnailUrl: null });

export function useStudioModel(): StudioModel {
  return use(StudioModelContext);
}
