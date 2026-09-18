// Set NEXT_PUBLIC_SITE_URL once a custom domain is attached.
export const SITE_URL = (
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000")
).replace(/\/$/, "");

export const SITE_NAME = "Freyya";
export const SITE_TAGLINE = "Your skin, but better.";
export const SITE_DESCRIPTION =
  "Six skincare products. Each one earns its place. Clean formulas, no noise.";
