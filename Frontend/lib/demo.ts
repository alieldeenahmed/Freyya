// The public demo is switched on with NEXT_PUBLIC_DEMO_MODE=true when the storefront is built.
// It only changes what visitors are told. The limits that protect the demo live in the API.
export const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export const DEMO_NOTICE =
  "Demo store. Payments are simulated and the data resets every night. Please don't enter real personal information.";

// Where the demo sign-in details are published.
export const DEMO_DETAILS_URL = "https://github.com/alieldeenahmed/Freyya#live-demo";
