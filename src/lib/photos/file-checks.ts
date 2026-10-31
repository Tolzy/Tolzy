import type { ImageFormat, PhotoCheck } from "./types";

export const MAX_BYTES = 20 * 1024 * 1024;
/** Required short edge for every photo (docs/design-system.md, Create portrait). */
export const MIN_SHORT_EDGE = 1024;
/** Decoding guard: larger images are refused before they exhaust memory. */
export const MAX_PIXELS = 60_000_000;

export const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.jpg,.jpeg,.png,.webp,.heic,.heif";

const FORMAT_NAMES: Record<ImageFormat, string> = { jpeg: "JPEG", png: "PNG", webp: "WebP", heic: "HEIC" };
export const formatName = (f: ImageFormat) => FORMAT_NAMES[f];

/**
 * Identifies the image format from the file's first bytes (its signature), not
 * its name or the browser-reported type, which can be wrong or spoofed.
 */
export function sniffFormat(head: Uint8Array): ImageFormat | null {
  const at = (i: number, ...bytes: number[]) => bytes.every((b, k) => head[i + k] === b);
  const ascii = (i: number, n: number) => String.fromCharCode(...head.slice(i, i + n));
  if (at(0, 0xff, 0xd8, 0xff)) return "jpeg";
  if (at(0, 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png";
  if (ascii(0, 4) === "RIFF" && ascii(8, 4) === "WEBP") return "webp";
  if (ascii(4, 4) === "ftyp") {
    const brand = ascii(8, 4);
    if (["heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1"].includes(brand)) return "heic";
  }
  return null;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** Checks that need only the file itself. */
export function fileChecks(file: { size: number; name: string }, format: ImageFormat | null): PhotoCheck[] {
  const checks: PhotoCheck[] = [];
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  checks.push(
    format
      ? { id: "format", label: "File type", status: "pass", message: `${formatName(format)} image.` }
      : {
          id: "format",
          label: "File type",
          status: "fail",
          message: ["gif", "bmp", "tif", "tiff", "avif", "svg"].includes(ext)
            ? `${ext.toUpperCase()} files aren’t supported. Save the photo as JPG, PNG, WebP or HEIC.`
            : "This isn’t a supported image. Choose a JPG, PNG, WebP or HEIC photo.",
        },
  );
  checks.push(
    file.size > MAX_BYTES
      ? {
          id: "size",
          label: "File size",
          status: "fail",
          message: `${formatBytes(file.size)} is over the 20 MB limit. Export a smaller copy (most phones offer “Medium” or “Large” sizes).`,
        }
      : file.size === 0
        ? { id: "size", label: "File size", status: "fail", message: "The file is empty." }
        : { id: "size", label: "File size", status: "pass", message: `${formatBytes(file.size)}.` },
  );
  return checks;
}

export function resolutionCheck(width: number, height: number): PhotoCheck {
  const short = Math.min(width, height);
  if (width * height > MAX_PIXELS)
    return {
      id: "resolution",
      label: "Resolution",
      status: "fail",
      message: `${width} × ${height} is too large to process. Use a copy under 60 megapixels.`,
    };
  if (short < MIN_SHORT_EDGE)
    return {
      id: "resolution",
      label: "Resolution",
      status: "fail",
      message: `${width} × ${height} is too small. The shorter side needs at least ${MIN_SHORT_EDGE} px — use the original photo, not a screenshot or thumbnail.`,
    };
  return { id: "resolution", label: "Resolution", status: "pass", message: `${width} × ${height} px.` };
}
