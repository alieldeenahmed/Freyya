import { spawnSync } from "node:child_process";

// Start every run from the same place: no orders, launch stock.
export default function globalSetup() {
  const result = spawnSync("npm", ["--prefix", "../Backend", "run", "db:reset:test"], {
    stdio: "inherit",
    shell: true,
  });
  if (result.status !== 0) throw new Error("Could not reset the test database.");
}
