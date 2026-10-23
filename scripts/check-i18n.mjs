// Fails if fr.json and ar.json do not have exactly the same keys. Run: npm run check:i18n
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../packages/shared/src/i18n");
const flat = (o, p = "") => Object.entries(o).flatMap(([k, v]) => (v && typeof v === "object" ? flat(v, `${p}${k}.`) : [`${p}${k}`]));
const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));
const keys = Object.fromEntries(files.map((f) => [f, new Set(flat(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"))))]));
const [ref, ...others] = files;
let ok = true;
for (const f of others) {
  for (const k of keys[ref]) if (!keys[f].has(k)) { ok = false; console.error(`${f} is missing ${k}`); }
  for (const k of keys[f]) if (!keys[ref].has(k)) { ok = false; console.error(`${ref} is missing ${k}`); }
}
console.log(ok ? `i18n OK (${keys[ref].size} keys, ${files.join(", ")})` : "i18n parity check failed");
process.exit(ok ? 0 : 1);
