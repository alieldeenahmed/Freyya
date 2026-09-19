// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProductAccordion from "@/components/ProductAccordion";
import ProductDetail from "@/components/ProductDetail";
import { products } from "@/data/products";
import { findProduct } from "@/lib/products";
import { getReviews } from "@/lib/reviews";
import { renderWithProviders } from "../render";

const balm = findProduct(products, "freyya-balm")!;
const serum = findProduct(products, "golden-hour-serum")!;

const renderDetail = (product = balm, catalog = products) =>
  renderWithProviders(<ProductDetail product={product} reviews={getReviews(product.id)} />, catalog);

const savedCart = () => JSON.parse(window.localStorage.getItem("freyya:cart") ?? "[]");

describe("Product page shade swatches", () => {
  it("starts on the first shade and shows which swatch is selected", () => {
    renderDetail();

    const swatches = screen.getAllByRole("button", { pressed: true });
    expect(swatches.map((b) => b.getAttribute("aria-label"))).toEqual(["Bare"]);
    expect(screen.getByText(/Shade — Bare/)).toBeTruthy();
    expect(screen.getAllByRole("button", { pressed: false }).map((b) => b.getAttribute("aria-label"))).toEqual([
      "Petal",
      "Rosewood",
      "Terracotta",
    ]);
  });

  it("switches the selected swatch, the label and the photograph", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: "Petal" }));

    expect(screen.getByRole("button", { name: "Petal" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Bare" }).getAttribute("aria-pressed")).toBe("false");
    expect(screen.getByText(/Shade — Petal/)).toBeTruthy();

    const shown = screen.getByAltText("Freyya Balm in Petal").parentElement!;
    const hidden = screen.getByAltText("Freyya Balm in Bare").parentElement!;
    expect(shown.className).toContain("opacity-100");
    expect(hidden.className).toContain("opacity-0");
  });

  it("shows each shade's own stock", async () => {
    const user = userEvent.setup();
    renderDetail();

    expect(screen.getByText("18 in stock")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Terracotta" }));
    expect(screen.getByText("Only 2 left")).toBeTruthy();
  });

  it("marks a sold-out shade for screen readers and blocks adding it", async () => {
    const user = userEvent.setup();
    const soldOutTerracotta = {
      ...balm,
      variants: balm.variants!.map((v) => (v.id === "terracotta" ? { ...v, stock: 0 } : v)),
    };
    renderDetail(soldOutTerracotta, products.map((p) => (p.id === balm.id ? soldOutTerracotta : p)));

    await user.click(screen.getByRole("button", { name: "Terracotta (sold out)" }));

    expect(screen.getByText("Sold out", { selector: "p" })).toBeTruthy();
    const add = screen.getByRole("button", { name: "Sold out" }) as HTMLButtonElement;
    expect(add.disabled).toBe(true);
  });
});

describe("Product page bag button", () => {
  it("adds the chosen shade to the saved bag at the catalog price", async () => {
    const user = userEvent.setup();
    renderDetail();

    await user.click(screen.getByRole("button", { name: "Rosewood" }));
    await user.click(screen.getByRole("button", { name: "Add to bag" }));

    expect(savedCart()).toMatchObject([
      { id: "freyya-balm:rosewood", productId: "freyya-balm", variantId: "rosewood", price: 24, quantity: 1 },
    ]);
    expect(screen.getByRole("button", { name: "Added to bag" })).toBeTruthy();
  });

  it("adds a product without shades under its own id", async () => {
    const user = userEvent.setup();
    renderDetail(serum);

    await user.click(screen.getByRole("button", { name: "Add to bag" }));

    expect(savedCart()).toMatchObject([{ id: "golden-hour-serum", quantity: 1, price: 58 }]);
  });

  it("stops offering more once everything in stock is already in the bag", () => {
    window.localStorage.setItem(
      "freyya:cart",
      JSON.stringify([{ id: "golden-hour-serum", productId: "golden-hour-serum", quantity: 3 }])
    );
    renderDetail(serum);

    const button = screen.getByRole("button", { name: "All 3 in your bag" }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("warns when only a few are left", () => {
    renderDetail(serum);
    expect(screen.getByText("Only 3 left")).toBeTruthy();
  });
});

describe("ProductAccordion", () => {
  const details = serum.details;

  it("opens the ingredients first and lets several sections stay open", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductAccordion details={details} />);

    const expanded = (name: string) =>
      screen.getByRole("button", { name }).getAttribute("aria-expanded");

    expect(expanded("Ingredients")).toBe("true");
    expect(expanded("Skin type")).toBe("false");

    await user.click(screen.getByRole("button", { name: "Skin type" }));

    expect(expanded("Skin type")).toBe("true");
    expect(expanded("Ingredients")).toBe("true");
  });

  it("closes a section on a second click", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductAccordion details={details} />);

    await user.click(screen.getByRole("button", { name: "Ingredients" }));

    expect(screen.getByRole("button", { name: "Ingredients" }).getAttribute("aria-expanded")).toBe(
      "false"
    );
  });

  it("points each button at a real panel", () => {
    renderWithProviders(<ProductAccordion details={details} />);

    for (const button of screen.getAllByRole("button")) {
      const panel = document.getElementById(button.getAttribute("aria-controls")!);
      expect(panel, button.textContent ?? "").not.toBeNull();
    }
  });

  it("shows the product's real details", () => {
    renderWithProviders(<ProductAccordion details={details} />);
    expect(screen.getByText(details.ingredients)).toBeTruthy();
  });
});
