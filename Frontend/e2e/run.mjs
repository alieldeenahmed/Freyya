// Runs the end-to-end tests the way CI does: reset the throwaway database, build the
// storefront against the test API's address, then run Playwright. Extra arguments go to Playwright.
import { spawnSync } from "node:child_process";

try {
  process.loadEnvFile("../Backend/.env.test");
} catch {
  // Already set by the environment.
}

function run(command, args, env = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...env },
  });
  if (result.status !== 0) process.exit(result.status ?? 1);
}

run("npm", ["--prefix", "../Backend", "run", "db:reset:test"]);
run("npx", ["next", "build"], { API_URL: "http://localhost:4010" });
run("npx", ["playwright", "test", ...process.argv.slice(2)]);
