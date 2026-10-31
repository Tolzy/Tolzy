"use client";

import { detectFaces, type DetectedFace } from "./face-detector";
import { fileChecks, resolutionCheck, sniffFormat } from "./file-checks";
import {
  colorStats,
  laplacianVariance,
  lightStats,
  normalizeContrast,
  QUALITY,
  regionMean,
  toGray,
} from "./image-quality";
import { worstStatus, type PhotoCheck, type PhotoResult, type SlotId } from "./types";

/** Long edge of the copy the checks run on (keeps analysis fast on phones). */
const ANALYSIS_EDGE = 1280;
const CROP = 256;

const isProfile = (slot: SlotId) => slot === "leftProfile" || slot === "rightProfile";
const isThreeQuarter = (slot: SlotId) => slot === "leftThreeQuarter" || slot === "rightThreeQuarter";

type Metrics = NonNullable<PhotoResult["metrics"]>;

function result(
  checks: PhotoCheck[],
  info: PhotoResult["info"],
  faceChecksRan: boolean,
  metrics?: Metrics,
): PhotoResult {
  return { checks, info, status: worstStatus(checks), faceChecksRan, metrics };
}

/**
 * Validates one photo entirely on this device: file signature and size,
 * decoding, resolution, then — with MediaPipe Face Landmarker — face count,
 * size, pose, visibility, eyes and expression, plus sharpness and lighting
 * measured on the face. Nothing is uploaded.
 */
export async function analyzePhoto(file: File, slot: SlotId): Promise<PhotoResult> {
  const metrics: Metrics = {};
  const head = new Uint8Array(await file.slice(0, 32).arrayBuffer());
  const format = sniffFormat(head);
  const checks = fileChecks(file, format);
  if (!format || worstStatus(checks) === "fail") return result(checks, null, false);

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    checks.push({
      id: "decode",
      label: "Readable image",
      status: "fail",
      message:
        format === "heic"
          ? "This browser can’t open HEIC photos. Use Safari, or export the photo as JPEG (on iPhone: Settings → Camera → Formats → Most Compatible)."
          : "The image couldn’t be opened — the file may be damaged or incomplete. Try exporting it again.",
    });
    return result(checks, { format, bytes: file.size, width: 0, height: 0 }, false);
  }
  const info = { format, bytes: file.size, width: bitmap.width, height: bitmap.height };
  checks.push({ id: "decode", label: "Readable image", status: "pass", message: "Opened successfully." });
  const res = resolutionCheck(bitmap.width, bitmap.height);
  checks.push(res);
  if (res.status === "fail") {
    bitmap.close();
    return result(checks, info, false);
  }

  // Work on a reduced copy.
  const scale = Math.min(1, ANALYSIS_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  let faces: DetectedFace[];
  try {
    faces = await detectFaces(canvas);
  } catch {
    checks.push({
      id: "face",
      label: "Face check",
      status: "warn",
      message:
        "The face check couldn’t run in this browser, so this photo hasn’t been checked for a face. It will be checked again after upload.",
    });
    return result(checks, info, false);
  }

  if (faces.length > 1) {
    checks.push({
      id: "single",
      label: "One person",
      status: "fail",
      message: `We found ${faces.length} faces. Use a photo with only the person you want to portray — crop others out.`,
    });
    return result(checks, info, true);
  }

  if (faces.length === 0) {
    if (isProfile(slot)) {
      checks.push({
        id: "face",
        label: "Side view",
        status: "pass",
        message:
          "Profile photos are checked for format, resolution and sharpness — face detection works on front-facing views.",
      });
      checks.push(
        sharpnessCheck(
          canvas,
          { x: canvas.width * 0.2, y: canvas.height * 0.15, width: canvas.width * 0.6, height: canvas.height * 0.6 },
          metrics,
        ),
      );
      return result(checks, info, true, metrics);
    }
    checks.push({
      id: "face",
      label: "Face detected",
      status: isThreeQuarter(slot) ? "warn" : "fail",
      message: isThreeQuarter(slot)
        ? "We couldn’t find a face. Make sure the face is clearly visible and turned no more than about 45°."
        : "We couldn’t find a face. Use a clear, front-facing photo where the whole face is visible and well lit.",
    });
    return result(checks, info, true);
  }

  const face = faces[0];
  checks.push({ id: "face", label: "Face detected", status: "pass", message: "One face found." });
  checks.push(...faceChecks(face, canvas, slot, 1 / scale, metrics));
  return result(checks, info, true, metrics);
}

function faceChecks(
  face: DetectedFace,
  canvas: HTMLCanvasElement,
  slot: SlotId,
  toOriginal: number,
  metrics: Metrics,
): PhotoCheck[] {
  const checks: PhotoCheck[] = [];
  const { box } = face;
  const relative = box.height / canvas.height;
  const pixels = Math.round(box.height * toOriginal);
  Object.assign(metrics, { yaw: face.yaw, pitch: face.pitch, faceHeight: relative });

  // Size
  if (pixels < 300 || relative < 0.14)
    checks.push({
      id: "faceSize",
      label: "Face size",
      status: "fail",
      message:
        "The face is too small to reconstruct. Move closer or crop so the head and shoulders fill most of the frame.",
    });
  else if (relative < 0.22)
    checks.push({
      id: "faceSize",
      label: "Face size",
      status: "warn",
      message: "The face is quite small in the frame. A closer crop (head and shoulders) gives more detail.",
    });
  else
    checks.push({
      id: "faceSize",
      label: "Face size",
      status: "pass",
      message: `About ${pixels} px tall — plenty of detail.`,
    });

  // Pose
  const yaw = Math.abs(face.yaw);
  const pitch = Math.abs(face.pitch);
  if (slot === "front") {
    if (yaw > 30 || pitch > 25)
      checks.push({
        id: "pose",
        label: "Facing the camera",
        status: "warn",
        message:
          "The head is turned away. Look straight into the lens for the main photo — side views go in More angles.",
      });
    else if (yaw > 15 || pitch > 15)
      checks.push({
        id: "pose",
        label: "Facing the camera",
        status: "warn",
        message: "The head is slightly turned. Face the camera directly for the best likeness.",
      });
    else checks.push({ id: "pose", label: "Facing the camera", status: "pass", message: "Looking straight ahead." });
  } else if (isThreeQuarter(slot)) {
    checks.push(
      yaw < 15
        ? {
            id: "pose",
            label: "Angle",
            status: "warn",
            message: "This looks front-facing. Turn the head about 45° for a three-quarter view.",
          }
        : { id: "pose", label: "Angle", status: "pass", message: `Turned about ${Math.round(yaw)}°.` },
    );
  } else {
    checks.push(
      yaw < 35
        ? {
            id: "pose",
            label: "Angle",
            status: "warn",
            message: "This doesn’t look like a side view. Turn the head about 90° so one ear faces the camera.",
          }
        : { id: "pose", label: "Angle", status: "pass", message: "Side view." },
    );
  }

  // Visibility: face cut off by the frame, hairline missing.
  const margin = 0.01 * Math.max(canvas.width, canvas.height);
  const clipped =
    box.x < margin ||
    box.y < margin ||
    box.x + box.width > canvas.width - margin ||
    box.y + box.height > canvas.height - margin;
  const forehead = face.points[10];
  const hairlineRoom = forehead ? forehead.y / canvas.height : 1;
  if (clipped)
    checks.push({
      id: "visible",
      label: "Whole face visible",
      status: "warn",
      message: "Part of the face is cut off at the edge. Leave space around the head.",
    });
  else if (hairlineRoom < 0.06)
    checks.push({
      id: "visible",
      label: "Whole face visible",
      status: "warn",
      message: "The top of the head is cut off. Keep the hairline and some space above it in the frame.",
    });
  else
    checks.push({
      id: "visible",
      label: "Whole face visible",
      status: "pass",
      message: "Face, hairline and jaw are in frame.",
    });

  // Crop the face (with some margin) for pixel measurements.
  const pad = 0.15;
  const region = {
    x: box.x - box.width * pad,
    y: box.y - box.height * pad,
    width: box.width * (1 + 2 * pad),
    height: box.height * (1 + 2 * pad),
  };
  const crop = cropGray(canvas, region);

  // Eyes: closed (blendshapes) or covered (dark eye regions vs cheeks — sunglasses).
  if (slot === "front" || isThreeQuarter(slot)) {
    const blink = Math.max(face.blend.eyeBlinkLeft ?? 0, face.blend.eyeBlinkRight ?? 0);
    const eyes = [face.points[159], face.points[386]].filter(Boolean);
    const cheeks = [face.points[50], face.points[280]].filter(Boolean);
    const sample = (p: { x: number; y: number }) => {
      const cx = ((p.x - region.x) / region.width) * CROP;
      const cy = ((p.y - region.y) / region.height) * CROP;
      const r = (box.width / region.width) * CROP * 0.06;
      return regionMean(crop, CROP, CROP, cx - r, cy - r, cx + r, cy + r);
    };
    const eyeLuma = eyes.length ? eyes.map(sample).reduce((a, b) => a + b) / eyes.length : 0;
    const cheekLuma = cheeks.length ? cheeks.map(sample).reduce((a, b) => a + b) / cheeks.length : 0;
    if (blink > 0.55 && slot === "front")
      checks.push({
        id: "eyes",
        label: "Eyes visible",
        status: "warn",
        message: "The eyes look closed. Use a photo with eyes open.",
      });
    else if (cheekLuma > 40 && eyeLuma < cheekLuma * 0.35)
      checks.push({
        id: "eyes",
        label: "Eyes visible",
        status: "warn",
        message: "The eyes look covered or in deep shadow. Remove sunglasses, and avoid hats or hair over the eyes.",
      });
    else checks.push({ id: "eyes", label: "Eyes visible", status: "pass", message: "Eyes are open and unobstructed." });
  }

  // Head covering: the band just above the forehead (where hair or a hat is).
  if (slot === "front" || isThreeQuarter(slot)) {
    const headwear = headwearCheck(face, canvas, metrics);
    checks.push(headwear);
    // Don't claim the hairline is visible when a covering hides it.
    const visible = checks.find((c) => c.id === "visible");
    if (headwear.status !== "pass" && visible?.status === "pass") visible.message = "Face and jaw are in frame.";
  }

  // Expression (main photo only).
  if (slot === "front") {
    const smile = Math.max(face.blend.mouthSmileLeft ?? 0, face.blend.mouthSmileRight ?? 0);
    const open = face.blend.jawOpen ?? 0;
    checks.push(
      smile > 0.6 || open > 0.35
        ? {
            id: "expression",
            label: "Neutral expression",
            status: "warn",
            message: "A relaxed, closed-mouth expression reconstructs best.",
          }
        : { id: "expression", label: "Neutral expression", status: "pass", message: "Relaxed expression." },
    );
  }

  checks.push(sharpnessFromGray(crop, metrics));
  // Exposure on the inner face only, so background never counts as shadow.
  const inner = {
    x: box.x + box.width * 0.12,
    y: box.y + box.height * 0.1,
    width: box.width * 0.76,
    height: box.height * 0.8,
  };
  checks.push(lightingCheck(cropGray(canvas, inner), metrics));
  return checks;
}

/** Mean RGBA statistics of a canvas region (clamped to the canvas). */
function regionColor(canvas: HTMLCanvasElement, x: number, y: number, w: number, h: number) {
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(canvas.width, Math.ceil(x + w));
  const y1 = Math.min(canvas.height, Math.ceil(y + h));
  if (x1 - x0 < 2 || y1 - y0 < 2) return null;
  const data = canvas.getContext("2d", { willReadFrequently: true })!.getImageData(x0, y0, x1 - x0, y1 - y0).data;
  return colorStats(data);
}

/**
 * Hats, caps and wraps hide the hairline and the shape of the head. The band
 * above the forehead (from the face landmarks) is compared with the skin:
 * natural hair is low in colourfulness, while most fabric coverings are
 * vivid, patterned, or clearly unlike both. A suggestion only — many people
 * wear head coverings, and plain dark hats can't be told from dark hair.
 */
function headwearCheck(face: DetectedFace, canvas: HTMLCanvasElement, metrics: Metrics): PhotoCheck {
  const pass: PhotoCheck = {
    id: "headwear",
    label: "Head uncovered",
    status: "pass",
    message: "Hairline and the top of the head are visible.",
  };
  const top = face.points[10];
  const left = face.points[109];
  const right = face.points[338];
  const cheekL = face.points[50];
  const cheekR = face.points[280];
  if (!top || !left || !right || !cheekL || !cheekR) return pass;
  const h = face.box.height;
  const x0 = Math.min(left.x, right.x);
  const width = Math.abs(right.x - left.x);
  // Close above the forehead, so short hair never lets the background in.
  const band = regionColor(canvas, x0 + width * 0.1, top.y - h * 0.26, width * 0.8, h * 0.18);
  const r = h * 0.05;
  const skinA = regionColor(canvas, cheekL.x - r, cheekL.y - r, 2 * r, 2 * r);
  const skinB = regionColor(canvas, cheekR.x - r, cheekR.y - r, 2 * r, 2 * r);
  if (!band || !skinA || !skinB) return pass;
  const skin = {
    r: (skinA.r + skinB.r) / 2,
    g: (skinA.g + skinB.g) / 2,
    b: (skinA.b + skinB.b) / 2,
    colourfulness: (skinA.colourfulness + skinB.colourfulness) / 2,
  };
  const distance = Math.hypot(band.r - skin.r, band.g - skin.g, band.b - skin.b);
  Object.assign(metrics, {
    crownColourfulness: band.colourfulness,
    crownSpread: band.lumaSpread,
    crownSkinDistance: distance,
    crownBright: band.brightShare,
  });
  // Relative to this person's own skin, so skin tone never triggers it.
  const vivid =
    band.colourfulness > skin.colourfulness + QUALITY.headwearExtraColourfulness &&
    distance > QUALITY.headwearSkinDistance;
  // Strong patterns that are either unlike the skin or woven with light
  // threads. Dark fabric on darker skin fails the colour test, but natural
  // dark hair is never striped with near-white.
  const patterned =
    band.lumaSpread > QUALITY.headwearSpread &&
    (distance > QUALITY.headwearSkinDistance || band.brightShare > QUALITY.headwearBrightShare);
  metrics.skinColourfulness = skin.colourfulness;
  if (vivid || patterned)
    return {
      id: "headwear",
      label: "Head uncovered",
      status: "warn",
      message:
        "The top of the head looks covered (hat, cap or wrap?). If you can, remove it — it hides the hairline and the shape of the head.",
    };
  return pass;
}

function cropGray(canvas: HTMLCanvasElement, r: { x: number; y: number; width: number; height: number }): Float32Array {
  const c = document.createElement("canvas");
  c.width = c.height = CROP;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "#808080";
  ctx.fillRect(0, 0, CROP, CROP);
  ctx.drawImage(canvas, r.x, r.y, r.width, r.height, 0, 0, CROP, CROP);
  return toGray(ctx.getImageData(0, 0, CROP, CROP).data);
}

function sharpnessCheck(
  canvas: HTMLCanvasElement,
  r: { x: number; y: number; width: number; height: number },
  metrics: Metrics,
): PhotoCheck {
  return sharpnessFromGray(cropGray(canvas, r), metrics);
}

function sharpnessFromGray(gray: Float32Array, metrics: Metrics): PhotoCheck {
  const v = laplacianVariance(normalizeContrast(gray), CROP, CROP);
  metrics.sharpness = v;
  if (v < QUALITY.sharpFail)
    return {
      id: "sharpness",
      label: "Sharp focus",
      status: "fail",
      message: "The photo is too blurry. Hold the camera steady, tap to focus on the face, and avoid motion.",
    };
  if (v < QUALITY.sharpWarn)
    return {
      id: "sharpness",
      label: "Sharp focus",
      status: "warn",
      message: "The face is a little soft. A sharper photo gives finer detail.",
    };
  return { id: "sharpness", label: "Sharp focus", status: "pass", message: "In focus." };
}

function lightingCheck(gray: Float32Array, metrics: Metrics): PhotoCheck {
  const s = lightStats(gray, CROP, CROP);
  Object.assign(metrics, { p5: s.p5, p95: s.p95, mean: s.mean, sideRatio: s.sideRatio });
  if (s.p95 < QUALITY.darkP95 || s.dark > QUALITY.clippedShare)
    return {
      id: "lighting",
      label: "Even lighting",
      status: "warn",
      message: "The face is too dark. Face a window or a soft light source.",
    };
  if (s.p5 > QUALITY.brightP5 || s.bright > QUALITY.clippedShare)
    return {
      id: "lighting",
      label: "Even lighting",
      status: "warn",
      message: "The face is overexposed. Avoid direct flash or harsh sunlight.",
    };
  if (s.sideRatio > QUALITY.unevenRatio)
    return {
      id: "lighting",
      label: "Even lighting",
      status: "warn",
      message: "One side of the face is much darker. Use softer, more even light from the front.",
    };
  return { id: "lighting", label: "Even lighting", status: "pass", message: "Well lit." };
}
