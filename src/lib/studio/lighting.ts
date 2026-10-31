/**
 * Lighting presets — pure data describing a complete light rig: direct lights,
 * hemisphere fill and the procedural environment (studio light panels) that
 * reflective materials mirror. Model-independent: positions assume a model
 * normalised to height 1 with its pivot at the origin.
 *
 * The environment is used for lighting and reflections only; the visible
 * viewport background stays whatever the Scene panel says.
 */

export type LightingPreset = "studio" | "dramatic" | "soft" | "rim" | "neutral";

type Vec3 = [number, number, number];

export interface DirectLight {
  position: Vec3;
  color: string;
  intensity: number;
  /** Casts a soft shadow map onto the model (one light per rig at most). */
  castShadow?: boolean;
}

export interface LightPanel {
  /** "rect" softbox or "ring" light. */
  form: "rect" | "ring";
  position: Vec3;
  scale: [number, number];
  color: string;
  intensity: number;
  /** Rotation in radians; panels without one face the model. */
  rotation?: Vec3;
}

export interface LightRig {
  id: LightingPreset;
  label: string;
  description: string;
  lights: DirectLight[];
  hemisphere: { sky: string; ground: string; intensity: number };
  environment: {
    intensity: number;
    /** Vertical gradient of the studio "walls" reflected by metals (top, bottom). */
    walls: [string, string];
    panels: LightPanel[];
  };
  /** Shadow softness for the shadow-casting light (blur radius, 1 = crisp). */
  shadowRadius: number;
}

export const LIGHTING_RIGS: Record<LightingPreset, LightRig> = {
  studio: {
    id: "studio",
    label: "Studio",
    description: "Balanced key and fill with a soft rim — the default.",
    lights: [
      { position: [-2.2, 2.4, 2.6], color: "#fff3e6", intensity: 2.1, castShadow: true },
      { position: [2.6, 1.6, -2.4], color: "#dfe8ff", intensity: 2.2 },
      { position: [-2.4, -0.4, -1.8], color: "#f0f0ff", intensity: 0.6 },
    ],
    hemisphere: { sky: "#e9eef6", ground: "#2a2622", intensity: 0.35 },
    environment: {
      intensity: 0.85,
      walls: ["#55555d", "#101012"],
      panels: [
        // Broad, dim wall behind the camera: what a mirror finish shows head-on.
        { form: "rect", position: [0, 0.6, 5], scale: [9, 3.5], color: "#d8dce4", intensity: 0.35 },
        {
          form: "rect",
          position: [0, 4, 1],
          scale: [6, 3],
          color: "#ffffff",
          intensity: 2.2,
          rotation: [Math.PI / 2, 0, 0],
        },
        { form: "rect", position: [-3, 1.2, 3], scale: [2.4, 3.2], color: "#fff4ea", intensity: 3 },
        { form: "rect", position: [3.2, 0.4, 2.4], scale: [2, 3], color: "#eef2ff", intensity: 0.9 },
        { form: "rect", position: [2.6, 1, -3], scale: [0.6, 4], color: "#e6eeff", intensity: 4 },
        { form: "rect", position: [-2.8, 1, -3], scale: [0.6, 4], color: "#fff1e6", intensity: 2.2 },
      ],
    },
    shadowRadius: 6,
  },
  dramatic: {
    id: "dramatic",
    label: "Dramatic",
    description: "One hard key from the side, deep shadows, cool edge.",
    lights: [
      { position: [-3.2, 1.6, 0.9], color: "#fff0dc", intensity: 3.6, castShadow: true },
      { position: [2.8, 1.2, -2.6], color: "#b9cbff", intensity: 1.6 },
    ],
    hemisphere: { sky: "#c9d2e0", ground: "#120f0d", intensity: 0.08 },
    environment: {
      intensity: 0.45,
      walls: ["#16161a", "#050506"],
      panels: [
        { form: "rect", position: [-3.5, 1.2, 1], scale: [1.2, 3.6], color: "#fff0dc", intensity: 5 },
        { form: "rect", position: [3, 1.5, -2.8], scale: [0.4, 4], color: "#c4d4ff", intensity: 3 },
      ],
    },
    shadowRadius: 2,
  },
  soft: {
    id: "soft",
    label: "Soft",
    description: "Large wrapping light with gentle, diffused shadows.",
    lights: [
      { position: [-1.4, 2.8, 3], color: "#fff8f0", intensity: 1.3, castShadow: true },
      { position: [2.2, 1.4, 2.4], color: "#f4f6ff", intensity: 0.8 },
    ],
    hemisphere: { sky: "#f2f2f4", ground: "#4a4440", intensity: 0.7 },
    environment: {
      intensity: 1.15,
      walls: ["#55555c", "#1d1d21"],
      panels: [
        {
          form: "rect",
          position: [0, 3.5, 2],
          scale: [8, 4],
          color: "#ffffff",
          intensity: 2.2,
          rotation: [Math.PI / 2.6, 0, 0],
        },
        { form: "rect", position: [-3.2, 0.8, 2.4], scale: [3.6, 4], color: "#fff8f0", intensity: 1.8 },
        { form: "rect", position: [3.2, 0.8, 2.4], scale: [3.6, 4], color: "#f4f6ff", intensity: 1.4 },
      ],
    },
    shadowRadius: 14,
  },
  rim: {
    id: "rim",
    label: "Rim",
    description: "Low front light, bright edges outlining the silhouette.",
    lights: [
      { position: [2.4, 1.8, -2.8], color: "#e3ecff", intensity: 4.2 },
      { position: [-2.4, 1.6, -2.8], color: "#ffe9d6", intensity: 3.4 },
      { position: [0, 0.6, 3], color: "#ffffff", intensity: 0.35, castShadow: true },
    ],
    hemisphere: { sky: "#9fb0c8", ground: "#0e0d0c", intensity: 0.12 },
    environment: {
      intensity: 0.6,
      walls: ["#202026", "#060607"],
      panels: [
        { form: "rect", position: [2.6, 1, -3], scale: [0.5, 4.5], color: "#e3ecff", intensity: 6 },
        { form: "rect", position: [-2.6, 1, -3], scale: [0.5, 4.5], color: "#ffe9d6", intensity: 5 },
        { form: "ring", position: [0, 0.5, 3.5], scale: [1.2, 1.2], color: "#ffffff", intensity: 0.6 },
      ],
    },
    shadowRadius: 4,
  },
  neutral: {
    id: "neutral",
    label: "Neutral",
    description: "Even, colour-accurate light for inspecting the model.",
    lights: [
      { position: [0, 2.2, 3], color: "#ffffff", intensity: 1.4, castShadow: true },
      { position: [-3, 1, 1], color: "#ffffff", intensity: 0.6 },
      { position: [3, 1, 1], color: "#ffffff", intensity: 0.6 },
    ],
    hemisphere: { sky: "#ffffff", ground: "#5a5a5a", intensity: 0.55 },
    environment: {
      intensity: 1,
      walls: ["#5c5c5c", "#2a2a2a"],
      panels: [
        { form: "rect", position: [0, 3, 3], scale: [5, 2.5], color: "#ffffff", intensity: 1.6 },
        { form: "rect", position: [-3.2, 1, 0], scale: [2, 4], color: "#ffffff", intensity: 1.2 },
        { form: "rect", position: [3.2, 1, 0], scale: [2, 4], color: "#ffffff", intensity: 1.2 },
        { form: "rect", position: [0, 1, -3.2], scale: [3, 4], color: "#ffffff", intensity: 0.8 },
      ],
    },
    shadowRadius: 10,
  },
};

export const LIGHTING_PRESET_ORDER: LightingPreset[] = ["studio", "dramatic", "soft", "rim", "neutral"];
