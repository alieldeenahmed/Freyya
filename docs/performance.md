# Performance

A measured baseline and a budget that keeps it from slipping. Nothing here was optimised on a hunch: each number below comes from the production build, and each thing that was left alone is listed with the reason.

## Measuring

```bash
npm --prefix Frontend run build
npm --prefix Frontend run perf          # per-page report, fails if a page is over its budget
npm --prefix Frontend run perf -- --json
```

`Frontend/scripts/bundle-report.mjs` reads the build's own manifests and adds up the gzipped JavaScript a first visit downloads for each page. The budget is `Frontend/perf-budget.json`, and CI runs the check after every build.

Sizes are **gzipped JavaScript that a modern browser downloads**. The 38.7 KB of polyfills is marked `nomodule`, so it is never fetched by a browser from the last several years, and it is not counted.

## Baseline (20 September 2026)

| Page | JS (KB, gzipped) | Budget |
| --- | --- | --- |
| Home | 202.5 | 219 |
| Shop | 203.7 | 220 |
| Product | 209.0 | 226 |
| Shade Match | 202.7 | 219 |
| Checkout | 207.3 | 224 |
| Confirmation | 202.6 | 219 |
| About, Contact, policies | 201.0 to 202.3 | 218 to 219 |
| Admin (all pages) | 201.8 to 205.4 | 218 to 222 |

CSS is 9.4 KB gzipped on every page. All client JavaScript in the build is 246.6 KB gzipped (budget 267).

Each budget is the baseline plus about 8 percent. It is meant to catch a dependency or a large component arriving by accident, not to forbid growth. Raising a number is allowed when it is deliberate, and the commit should say why.

### Where the bytes are

| Part | KB gz | What it is |
| --- | --- | --- |
| Framework | 127.8 | React DOM (73), the Next.js router (43), and the runtime and small shared pieces (12) |
| The site's own code, shared | about 74 | GSAP with ScrollTrigger (52.8 in one chunk), Flip and Lenis (about 9), the header, the bag, the providers |
| The page itself | 0 to 7 | Almost nothing. The product page is the largest |

Two other measurements:

- The catalog handed to the browser on every page is 6.1 KB raw and 2.1 KB gzipped. Six products make this negligible. It would need pagination or a lazy fetch at hundreds of products.
- The HTML for a page is 10 to 13 KB gzipped, and pages are pre-rendered, so the first paint does not wait on JavaScript.

## What was found, and what was decided

**The animation code is in every page.** GSAP with ScrollTrigger is a single 52.8 KB gzipped chunk, and Flip and Lenis add about 9 KB more. That is most of the site's own shared code, and it loads from the root layout because the header and the reveal-on-scroll wrapper use them almost everywhere. Loading ScrollTrigger and Flip only where they are used would move the cost around more than remove it, since `Reveal` is on nearly every page, and it risks flashes of unanimated content. Left as it is. If the budget ever needs the room, this is where it is.

**The admin pages pay for the storefront's animation code.** They share the root layout, so they download the same 200 KB. It only affects one person and does not touch the shop. Giving the admin its own root layout through route groups would fix it, and is the cleanest change if it ever matters.

**Images are already handled.** They go through `next/image` with `sizes` matched to the layout, and the first photographs are marked `priority`. The largest source photograph is 165 KB, and browsers are sent resized AVIF or WebP. Fonts are self-hosted through `next/font`.

**Client components.** Anything with state or motion is a client component and everything else is a server component, so the pages, the catalog fetch, the footer, the metadata and the whole admin shell arrive as HTML. There is no unnecessary hydration to remove at this size.

**Repeated work.** The bag re-checks itself against the catalog only when the saved bag or the catalog changes, and the pure function that does it works on a handful of lines. The new change-explanation does one pass over the same handful. Neither shows up as a cost.

**Lenis.** It is stopped while the bag is open, and not started at all when the visitor asks for reduced motion.

## Not covered

- There is no Lighthouse run in CI. The scores recorded in `Frontend/README.md` came from a manual local run and should be read as ranges.
- There is no measurement of real users (Core Web Vitals in the field). A page hosted on Vercel could add that with its free analytics.
- Server response times were not measured. Pages are pre-rendered, so most requests never reach a function.
