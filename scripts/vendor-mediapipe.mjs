// Copies MediaPipe's WebAssembly runtime from node_modules into public/ so the
// photo checks load it from our own origin (no third-party CDN). Runs before
// `dev` and `build` (package.json); the copies are git-ignored.
import { copyFile, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const src = "node_modules/@mediapipe/tasks-vision/wasm";
const dest = "public/vendor/mediapipe/wasm";
const files = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

await mkdir(dest, { recursive: true });
for (const f of files) {
  const from = join(src, f);
  const to = join(dest, f);
  const [a, b] = await Promise.all([stat(from), stat(to).catch(() => null)]);
  if (b && b.size === a.size && b.mtimeMs >= a.mtimeMs) continue;
  await copyFile(from, to);
}
console.log(`MediaPipe runtime ready in ${dest}`);
