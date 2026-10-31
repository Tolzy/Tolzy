"use client";

import { useSearchParams } from "next/navigation";
import { LazyViewer } from "@/components/viewer/lazy-viewer";
import { LIGHTING_RIGS, type LightingPreset } from "@/lib/studio/lighting";
import { MATERIAL_PRESET_DEFS, type MaterialPreset } from "@/lib/studio/materials";
import { SAMPLE_FRAMING, SAMPLE_MODEL } from "@/lib/studio/sample-model";
import { backgroundToCss, DEFAULT_SETTINGS, materialSettings } from "@/lib/studio/settings";

/** ?material=<preset> (studio light) or ?lighting=<preset> (original material). */
export function PreviewRender() {
  const params = useSearchParams();
  const m = params.get("material") as MaterialPreset | null;
  const l = params.get("lighting") as LightingPreset | null;
  const material = materialSettings(m && m in MATERIAL_PRESET_DEFS ? m : "original");
  const lighting = { ...DEFAULT_SETTINGS.lighting, preset: l && l in LIGHTING_RIGS ? l : "studio" };
  const background = DEFAULT_SETTINGS.background;

  return (
    <div
      data-preview
      className="relative size-[320px] overflow-hidden"
      style={{ background: backgroundToCss(background) }}
    >
      <LazyViewer
        url={SAMPLE_MODEL.url}
        framing={SAMPLE_FRAMING}
        material={material}
        background={background}
        lighting={lighting}
        motion={{ ...DEFAULT_SETTINGS.motion, tracking: false, dragEnabled: false }}
        reducedMotion
        zoom={175}
        resetKey={0}
        label="Preview"
      />
    </div>
  );
}
