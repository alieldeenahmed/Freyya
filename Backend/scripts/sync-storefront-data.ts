import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { FILES, STOREFRONT_DATA } from "./storefront-data.js";

// Usage:
//   npm run sync:data          write the storefront's snapshot from the API's own data
//   npm run sync:data:check    fail if the snapshot is out of date (used in CI)

const check = process.argv.includes("--check");
let stale = 0;

for (const { file, render } of FILES) {
  const target = path.join(STOREFRONT_DATA, file);
  const wanted = render();
  const current = existsSync(target) ? readFileSync(target, "utf8").replace(/\r\n/g, "\n") : null;

  if (current === wanted) {
    console.log(`up to date   Frontend/data/${file}`);
  } else if (check) {
    console.error(`out of date  Frontend/data/${file}`);
    stale += 1;
  } else {
    writeFileSync(target, wanted);
    console.log(`written      Frontend/data/${file}`);
  }
}

if (stale > 0) {
  console.error("\nRun `npm run sync:data` from the repository root, then commit the result.");
  process.exit(1);
}
