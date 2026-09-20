// Measures what a first visit to each page downloads, from the production build in .next, and
// checks it against the budget in perf-budget.json. Run it after `npm run build`.
//
//   npm run perf            report, and fail if any page is over its budget
//   npm run perf -- --json  the same numbers as JSON, for setting or updating the budget
//
// Sizes are gzipped, which is what a browser downloads. JavaScript and CSS only: images and
// fonts are handled by next/image and next/font.
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import path from "node:path";
import { gzipSync } from "node:zlib";

const root = path.resolve(import.meta.dirname, "..");
const build = path.join(root, ".next");
const asJson = process.argv.includes("--json");

if (!existsSync(path.join(build, "build-manifest.json"))) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(2);
}

const gzipCache = new Map();
function gzipSize(file) {
  if (!gzipCache.has(file)) gzipCache.set(file, gzipSync(readFileSync(path.join(build, file))).length);
  return gzipCache.get(file);
}

const buildManifest = JSON.parse(readFileSync(path.join(build, "build-manifest.json"), "utf8"));
// The framework itself: React and the router. Every page pays for these. The polyfills are
// marked nomodule, so a modern browser never downloads them, and they are left out of every count.
const shared = buildManifest.rootMainFiles ?? [];
const polyfills = buildManifest.polyfillFiles ?? [];

function* clientManifests(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* clientManifests(full);
    else if (entry === "page_client-reference-manifest.js") yield full;
  }
}

const appDir = path.join(build, "server", "app");
const pages = new Map();

for (const file of clientManifests(appDir)) {
  const source = readFileSync(file, "utf8");
  const manifest = JSON.parse(source.slice(source.indexOf("] = ") + 4).replace(/;\s*$/, ""));
  const route = "/" + path.relative(appDir, path.dirname(file)).replace(/\\/g, "/").replace(/^page$/, "");
  const entries = manifest.entryJSFiles ?? {};
  const css = manifest.entryCSSFiles ?? {};

  const pageKey = Object.keys(entries).find((key) => key.endsWith("/page"));
  const keys = ["[project]/app/layout", pageKey].filter(Boolean);
  const js = new Set([...shared, ...keys.flatMap((key) => entries[key] ?? [])]);
  const styles = new Set(keys.flatMap((key) => (css[key] ?? []).map((c) => (typeof c === "string" ? c : c.path))));

  pages.set(route === "/" ? "/" : route.replace(/\/$/, ""), {
    js: [...js].reduce((sum, f) => sum + gzipSize(f), 0),
    css: [...styles].filter(Boolean).reduce((sum, f) => sum + gzipSize(f), 0),
  });
}

const chunkDir = path.join(build, "static", "chunks");
const allChunks = readdirSync(chunkDir).filter(
  (f) => f.endsWith(".js") && !polyfills.some((p) => p.endsWith(f))
);
const totalJs = allChunks.reduce((sum, f) => sum + gzipSize(path.join("static", "chunks", f)), 0);

const kb = (bytes) => Math.round((bytes / 1024) * 10) / 10;
const rows = [...pages.entries()]
  .filter(([route]) => !route.includes("opengraph-image") && !route.includes("apple-icon") && route !== "/icon" && !route.startsWith("/_"))
  .map(([route, size]) => ({ route, js: kb(size.js), css: kb(size.css) }))
  .sort((a, b) => a.route.localeCompare(b.route));

const budget = existsSync(path.join(root, "perf-budget.json"))
  ? JSON.parse(readFileSync(path.join(root, "perf-budget.json"), "utf8"))
  : null;

if (asJson) {
  console.log(JSON.stringify({ totalJs: kb(totalJs), shared: kb(shared.reduce((s, f) => s + gzipSize(f), 0)), routes: Object.fromEntries(rows.map((r) => [r.route, r.js])) }, null, 2));
  process.exit(0);
}

let failed = 0;
const pad = (text, width) => String(text).padEnd(width);
console.log(`${pad("Route", 28)}${pad("JS (KB gz)", 13)}${pad("CSS (KB gz)", 13)}Budget`);
for (const row of rows) {
  const limit = budget?.routes?.[row.route] ?? budget?.defaultRoute;
  const over = limit !== undefined && row.js > limit;
  if (over) failed += 1;
  console.log(`${pad(row.route, 28)}${pad(row.js, 13)}${pad(row.css, 13)}${limit === undefined ? "-" : `${limit}${over ? "  OVER" : ""}`}`);
}
const totalOver = budget?.totalJs !== undefined && kb(totalJs) > budget.totalJs;
if (totalOver) failed += 1;
console.log(`\nAll client JavaScript in the build: ${kb(totalJs)} KB gz${budget?.totalJs !== undefined ? ` (budget ${budget.totalJs}${totalOver ? ", OVER" : ""})` : ""}`);
console.log(`Shared by every page (React, router): ${kb(shared.reduce((s, f) => s + gzipSize(f), 0))} KB gz`);
console.log(`Polyfills, for old browsers only (not counted above): ${kb(polyfills.reduce((s, f) => s + gzipSize(f), 0))} KB gz`);

if (failed > 0) {
  console.error(`\n${failed} over budget. Either something grew that should not have, or the budget in perf-budget.json needs a deliberate raise.`);
  process.exit(1);
}
