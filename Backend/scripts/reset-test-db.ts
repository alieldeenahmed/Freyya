import { createTestContext } from "../tests/helpers.js";

// Puts the throwaway test database back to a known state: no orders, launch stock.
// Refuses to run against DATABASE_URL, the same guard the tests use.
const context = await createTestContext();
try {
  await context.reset();
  console.log("Test database reset.");
} finally {
  await context.close();
}
