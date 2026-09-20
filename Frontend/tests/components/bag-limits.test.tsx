// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartDrawer from "@/components/CartDrawer";
import ProductDetail from "@/components/ProductDetail";
import { products } from "@/data/products";
import { useCart } from "@/lib/cart-context";
import { findProduct } from "@/lib/products";
import { getReviews } from "@/lib/reviews";
import { renderWithProviders } from "../render";

// Dawn Cleanse has 24 in stock, but one order can hold at most ten of anything.
const dawn = findProduct(products, "dawn-cleanse")!;
const serum = findProduct(products, "golden-hour-serum")!; // 3 in stock

function Page() {
  const { open } = useCart();
  return (
    <>
      <div id="site-content">
        <button type="button" onClick={open}>
          Open bag
        </button>
      </div>
      <CartDrawer />
    </>
  );
}

const seed = (id: string, quantity: number) =>
  window.localStorage.setItem("freyya:cart", JSON.stringify([{ id, productId: id, quantity }]));

describe("The bag and the limit of ten per order", () => {
  it("holds ten of an item with 24 in stock, and says why it stops there", async () => {
    seed("dawn-cleanse", 24);
    const user = userEvent.setup();
    renderWithProviders(<Page />);
    await user.click(screen.getByRole("button", { name: "Open bag" }));

    const drawer = screen.getByRole("dialog", { hidden: true });
    expect(within(drawer).getByText("Maximum per order")).toBeTruthy();
    expect((within(drawer).getByRole("button", { name: /Increase quantity/ }) as HTMLButtonElement).disabled).toBe(true);
    expect(within(drawer).getByText("Your bag changed")).toBeTruthy();
    expect(drawer.textContent).toContain("one order can hold at most 10");
  });

  it("calls it 'Maximum available' when it is the stock that runs out", async () => {
    seed("golden-hour-serum", 3);
    const user = userEvent.setup();
    renderWithProviders(<Page />);
    await user.click(screen.getByRole("button", { name: "Open bag" }));

    expect(screen.getByText("Maximum available")).toBeTruthy();
    expect(screen.queryByText("Maximum per order")).toBeNull();
  });

  it("stops the product page adding an eleventh, and says the limit", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDetail product={dawn} reviews={getReviews(dawn.id)} />);
    const add = () => screen.getByRole("button", { name: /Add to bag|Added to bag|in your bag/ }) as HTMLButtonElement;

    for (let i = 0; i < 10; i++) await user.click(add());

    await waitFor(() => expect(add().textContent).toBe("10 in your bag, the most per order"), { timeout: 4000 });
    expect(add().disabled).toBe(true);
  });

  it("says 'All 3 in your bag' when the stock is what ran out", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductDetail product={serum} reviews={getReviews(serum.id)} />);
    const add = () => screen.getByRole("button", { name: /Add to bag|Added to bag|in your bag/ }) as HTMLButtonElement;

    for (let i = 0; i < 3; i++) await user.click(add());

    await waitFor(() => expect(add().textContent).toBe("All 3 in your bag"), { timeout: 4000 });
    expect(add().disabled).toBe(true);
  });
});
