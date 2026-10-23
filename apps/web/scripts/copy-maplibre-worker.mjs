// MapLibre v6 runs its worker as an ES module that imports a shared chunk.
// Bundlers rewrite import.meta.url, so we serve the two files statically and call setWorkerUrl().
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dist = path.dirname(require.resolve("maplibre-gl/package.json")) + "/dist";
const out = path.resolve("public/maplibre");
fs.mkdirSync(out, { recursive: true });
for (const f of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) fs.copyFileSync(path.join(dist, f), path.join(out, f));
console.log("maplibre worker copied to public/maplibre");
