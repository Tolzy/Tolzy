# MediaPipe Face Landmarker model

`face_landmarker.task` — Google MediaPipe Face Landmarker (float16, version 1),
used by the New Portrait page to check photos **on the user's device**
(face count, size, pose, eyes, expression). Photos are never sent anywhere
for these checks.

- Source: https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task
- Licence: Apache License 2.0 (MediaPipe solutions and models,
  https://github.com/google-ai-edge/mediapipe — LICENSE)
- Guide and model cards: https://ai.google.dev/edge/mediapipe/solutions/vision/face_landmarker
- SHA-256: 64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff
- Size: 3,758,596 bytes

The WebAssembly runtime (`@mediapipe/tasks-vision`, Apache-2.0) is copied
from `node_modules` to `public/vendor/mediapipe/wasm` by
`scripts/vendor-mediapipe.mjs` before `npm run dev` / `npm run build`.
