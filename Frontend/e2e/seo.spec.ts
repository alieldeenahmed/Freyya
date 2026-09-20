import { expect, test, type Page } from "@playwright/test";

// What search engines and link previews see. Read from the production build, as a crawler would.

const meta = (page: Page, selector: string) => page.locator(selector).first().getAttribute("content");
const canonical = (page: Page) => page.locator('link[rel="canonical"]').getAttribute("href");

const INDEXED = [
  ["/", /^Freyya — /, "/"],
  ["/shop", /^Shop — Freyya$/, "/shop"],
  ["/shop/freyya-balm", /^Freyya Balm — Freyya$/, "/shop/freyya-balm"],
  ["/quiz", /^Find your shade — Freyya$/, "/quiz"],
  ["/about", /^About — Freyya$/, "/about"],
  ["/contact", /^Contact — Freyya$/, "/contact"],
  ["/shipping-returns", /— Freyya$/, "/shipping-returns"],
  ["/privacy", /^Privacy — Freyya$/, "/privacy"],
  ["/terms", /^Terms — Freyya$/, "/terms"],
] as const;

test.describe("Pages that should be found", () => {
  for (const [path, title, canonicalPath] of INDEXED) {
    test(`${path} has a title, description, canonical address and share preview`, async ({ page }) => {
      const response = await page.goto(path);
      expect(response?.status()).toBe(200);

      await expect(page).toHaveTitle(title);

      const description = await meta(page, 'meta[name="description"]');
      expect(description, "meta description").toBeTruthy();
      expect(description!.length).toBeGreaterThan(40);
      expect(description!.length).toBeLessThan(200);

      const url = new URL((await canonical(page))!);
      expect(url.pathname).toBe(canonicalPath);
      // An absolute address, and not one that points at the storefront's own dev port by accident.
      expect(url.protocol).toMatch(/^https?:$/);

      expect(await meta(page, 'meta[property="og:title"]')).toBeTruthy();
      expect(await meta(page, 'meta[property="og:image"]')).toMatch(/^https?:\/\//);
      expect(await meta(page, 'meta[name="twitter:card"]')).toBe("summary_large_image");
      expect(await meta(page, 'meta[name="theme-color"]')).toBe("#f7f3ee");

      // Nothing tells search engines to stay away.
      const robots = await page.locator('meta[name="robots"]').count();
      if (robots > 0) expect(await meta(page, 'meta[name="robots"]')).not.toMatch(/noindex/);
    });
  }

  test("every page has exactly one main heading, and the page is in English", async ({ page }) => {
    for (const [path] of INDEXED) {
      await page.goto(path);
      await expect(page.locator("html")).toHaveAttribute("lang", "en");
      await expect(page.getByRole("heading", { level: 1 }), path).toHaveCount(1);
    }
  });
});

test.describe("Pages that should not be found", () => {
  for (const path of ["/checkout", "/admin/login"]) {
    test(`${path} tells search engines to stay away`, async ({ page }) => {
      await page.goto(path);
      expect(await meta(page, 'meta[name="robots"]')).toMatch(/noindex/);
    });
  }

  test("an unknown address is a real 404 that is kept out of search", async ({ page }) => {
    const response = await page.goto("/no-such-page");
    expect(response?.status()).toBe(404);
    expect(await meta(page, 'meta[name="robots"]')).toMatch(/noindex/);
    await expect(page.getByRole("heading", { level: 1, name: /isn.t here/ })).toBeVisible();
  });

  test("an unknown product is a real 404 too", async ({ page }) => {
    const response = await page.goto("/shop/no-such-product");
    expect(response?.status()).toBe(404);
  });
});

test.describe("robots.txt and the sitemap", () => {
  test("robots.txt keeps crawlers out of checkout, the admin and the API, and points at the sitemap", async ({ request }) => {
    const res = await request.get("/robots.txt");
    expect(res.status()).toBe(200);
    const text = await res.text();

    expect(text).toMatch(/User-Agent: \*/i);
    for (const path of ["/checkout", "/admin", "/api/"]) expect(text).toContain(`Disallow: ${path}`);
    expect(text).toMatch(/Sitemap: https?:\/\/.+\/sitemap\.xml/);
  });

  test("the sitemap lists every page and product, and nothing that is kept out of search", async ({ request }) => {
    const res = await request.get("/sitemap.xml");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toMatch(/xml/);
    const paths = [...(await res.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);

    for (const [path] of INDEXED) expect(paths, path).toContain(path);
    for (const id of ["dawn-cleanse", "golden-hour-serum", "second-skin-cream", "veil-spf", "freyya-balm", "dew-drops"]) {
      expect(paths).toContain(`/shop/${id}`);
    }
    expect(paths.some((p) => p.startsWith("/checkout") || p.startsWith("/admin"))).toBe(false);
    expect(new Set(paths).size).toBe(paths.length);
  });
});

test.describe("Links", () => {
  test("every internal link on every page in the sitemap leads somewhere", async ({ page, request }) => {
    const sitemap = await (await request.get("/sitemap.xml")).text();
    const pages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]!).pathname);
    expect(pages.length).toBeGreaterThan(10);

    const links = new Map<string, string>();
    for (const path of pages) {
      await page.goto(path);
      const hrefs = await page.locator("a[href]").evaluateAll((anchors) =>
        anchors.map((a) => (a as HTMLAnchorElement).getAttribute("href") ?? "")
      );
      for (const href of hrefs) {
        // Same-site addresses only. Anchors on the same page and mail links are fine as they are.
        if (href.startsWith("/") && !href.startsWith("//")) links.set(href.split("#")[0]!.split("?")[0]!, path);
      }
    }
    expect(links.size).toBeGreaterThan(10);

    const broken: string[] = [];
    for (const [href, foundOn] of links) {
      if (href === "") continue;
      const res = await request.get(href, { maxRedirects: 0 });
      // 200 is a page. 307 is the admin sending an anonymous visitor to sign in.
      if (![200, 307].includes(res.status())) broken.push(`${href} answered ${res.status()} (linked from ${foundOn})`);
    }
    expect(broken).toEqual([]);
  });
});

test.describe("Products in search results and link previews", () => {
  test("a product page describes itself as a Product with a price and whether it is in stock", async ({ page }) => {
    await page.goto("/shop/golden-hour-serum");
    const raw = await page.locator('script[type="application/ld+json"]').first().textContent();
    const data = JSON.parse(raw!);

    expect(data["@type"]).toBe("Product");
    expect(data.name).toBe("Golden Hour Serum");
    expect(data.offers).toMatchObject({ "@type": "Offer", priceCurrency: "USD", price: 58 });
    expect(data.offers.availability).toMatch(/^https:\/\/schema\.org\/(InStock|OutOfStock)$/);
    expect(data.offers.url).toMatch(/\/shop\/golden-hour-serum$/);
    expect(data.aggregateRating.reviewCount).toBeGreaterThan(0);
    expect(data.image.length).toBeGreaterThan(0);
    // Written so a product name can never close the script tag early.
    expect(raw).not.toContain("</script");
  });

  test("each product has its own share picture, and it is a real image", async ({ page, request }) => {
    await page.goto("/shop/dawn-cleanse");
    const image = await meta(page, 'meta[property="og:image"]');
    expect(image).toContain("/shop/dawn-cleanse/opengraph-image");
    expect(await meta(page, 'meta[property="og:image:width"]')).toBe("1200");
    expect(await meta(page, 'meta[property="og:image:height"]')).toBe("630");

    const res = await request.get(new URL(image!).pathname);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toBe("image/png");
    expect((await res.body()).length).toBeGreaterThan(5_000);
  });

  test("the site has icons for browser tabs and phone home screens", async ({ request }) => {
    for (const path of ["/icon", "/apple-icon"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
      expect(res.headers()["content-type"]).toMatch(/^image\//);
    }
  });
});
