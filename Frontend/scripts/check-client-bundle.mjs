// Fails if anything meant to stay on the server has ended up in files the browser downloads.
//
// Build with recognisable fake values for the server-only settings, then run this. It looks
// through .next/static (everything served to browsers) for those values, and for the shapes
// secrets take. See the "storefront" job in .github/workflows/ci.yml for how it is used.
//
//   API_URL=http://sentinel-api.example:4999 npm run build && npm run check:bundle
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");
const staticDir = path.join(root, ".next", "static");

if (!existsSync(staticDir)) {
  console.error("No production build found. Run `npm run build` first.");
  process.exit(2);
}

// Settings that only the server may know. If one is set for the build, its value must not
// appear in anything sent to a browser. (NEXT_PUBLIC_* values are meant to be public.)
const SERVER_ONLY = [
  "API_URL",
  "DATABASE_URL",
  "DATABASE_URL_UNPOOLED",
  "TEST_DATABASE_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD_HASH",
  "ADMIN_SESSION_HOURS",
  "CRON_SECRET",
  "PROXY_SECRET",
  "API_BYPASS_TOKEN",
];

// Shapes that are never fine in a browser file, whatever their value.
const SHAPES = [
  [/postgres(ql)?:\/\/[^\s"'`]+@/i, "a database connection string"],
  [/scrypt\$[0-9a-f]{8,}\$[0-9a-f]{8,}/i, "a password hash"],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, "a private key"],
  [/npg_[A-Za-z0-9]{8,}/, "a Neon database password"],
];

const values = SERVER_ONLY.flatMap((name) => {
  const value = process.env[name];
  // Very short or common values (such as "12") would match by accident, so they are not searched for.
  return value && value.length >= 8 ? [{ name, value }] : [];
});

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) yield* files(full);
    else if (/\.(js|css|html|json|map|txt)$/.test(entry)) yield full;
  }
}

const problems = [];
let scanned = 0;

for (const file of files(staticDir)) {
  const text = readFileSync(file, "utf8");
  scanned += 1;
  const shown = path.relative(root, file);

  for (const { name, value } of values) {
    if (text.includes(value)) problems.push(`${shown} contains the value of ${name}`);
  }
  for (const [pattern, what] of SHAPES) {
    if (pattern.test(text)) problems.push(`${shown} contains ${what}`);
  }
}

console.log(`Looked through ${scanned} files served to browsers, for ${values.length} server-only value(s) and ${SHAPES.length} kinds of secret.`);
if (values.length === 0) {
  console.log("Note: none of the server-only settings were set for this build, so only the secret shapes were checked.");
}

if (problems.length > 0) {
  console.error("\nSomething private is in the browser bundle:");
  for (const problem of problems) console.error(`  ${problem}`);
  process.exit(1);
}
console.log("Nothing private is in the browser bundle.");
