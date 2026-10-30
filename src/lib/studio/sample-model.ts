/**
 * The bundled sample head. It is a development and demonstration asset built
 * from CC0 MakeHuman assets — not an AI-generated portrait of a real person.
 * Sources, licences and the build pipeline: scripts/sample-head/README.md.
 */
export const SAMPLE_MODEL = {
  url: "/models/sample-head/sample-head.glb",
  name: "Sample head",
  licence: "CC0 1.0",
  credit: "Built from MakeHuman assets (CC0)",
  creditUrl: "https://www.makehumancommunity.org/",
} as const;

/** Per-model placement hints. Generated portraits will store these per asset. */
export interface ModelFraming {
  /** Rotation applied before normalisation, in radians (fixes forward axis differences). */
  orientation: [number, number, number];
  /** Height of the rotation pivot as a fraction of the model height (0 = base, 1 = top). */
  pivot: number;
  /** Height the camera looks at, as a fraction of the model height. */
  focus: number;
}

export const SAMPLE_FRAMING: ModelFraming = {
  orientation: [0, 0, 0],
  pivot: 0.62,
  focus: 0.6,
};
