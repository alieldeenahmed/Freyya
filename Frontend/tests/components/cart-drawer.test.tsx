// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartDrawer from "@/components/CartDrawer";
import { useCart } from "@/lib/cart-context";
import { renderWithProviders } from "../render";

function Page() {
  const { open, itemCount } = useCart();
  return (
    <>
      <div id="site-content">
        <button type="button" data-cart-button onClick={open}>
          Open bag
        </button>
        <p data-testid="count">{itemCount}</p>
      </div>
      <CartDrawer />
    </>
  );
}

const line = (id: string, productId: string, quantity: number, variantId?: string) => ({
  id,
  productId,
  quantity,
  ...(variantId && { variantId }),
});

function seed(...lines: ReturnType<typeof line>[]) {
  window.localStorage.setItem("freyya:cart", JSON.stringify(lines));
}

const dialog = () => screen.getByRole("dialog", { hidden: true });
const savedCart = () => JSON.parse(window.localStorage.getItem("freyya:cart") ?? "[]");

async function openBag() {
  const user = userEvent.setup();
  renderWithProviders(<Page />);
  await user.click(screen.getByRole("button", { name: "Open bag" }));
  return user;
}

describe("Cart drawer as a modal dialog", () => {
  it("is out of reach while closed", () => {
    renderWithProviders(<Page />);

    expect(dialog().hasAttribute("inert")).toBe(true);
    expect(dialog().getAttribute("aria-modal")).toBe("true");
    expect(dialog().getAttribute("aria-label")).toBe("Your bag");
  });

  it("moves focus in and locks the page behind it when opened", async () => {
    await openBag();

    expect(dialog().hasAttribute("inert")).toBe(false);
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Close cart" }));
    expect((document.getElementById("site-content") as HTMLElement & { inert: boolean }).inert).toBe(true);
    expect(document.documentElement.style.overflow).toBe("hidden");
  });

  it("closes on Escape and puts focus and scrolling back", async () => {
    const user = await openBag();

    await user.keyboard("{Escape}");

    expect(dialog().hasAttribute("inert")).toBe(true);
    expect((document.getElementById("site-content") as HTMLElement & { inert: boolean }).inert).toBe(false);
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Open bag" }));
  });

  it("closes from the close button and from the overlay", async () => {
    const user = await openBag();
    await user.click(screen.getByRole("button", { name: "Close cart" }));
    expect(dialog().hasAttribute("inert")).toBe(true);

    await user.click(screen.getByRole("button", { name: "Open bag" }));
    expect(dialog().hasAttribute("inert")).toBe(false);
    await user.click(document.querySelector("[aria-hidden]:not(svg):not(span)") as HTMLElement);
    expect(dialog().hasAttribute("inert")).toBe(true);
  });

  it("keeps Tab inside the dialog, wrapping at both ends", async () => {
    seed(line("dawn-cleanse", "dawn-cleanse", 1));
    const user = await openBag();

    const ordered = [...dialog().querySelectorAll<HTMLElement>("a[href], button:not([disabled])")];
    expect(ordered.length).toBeGreaterThan(2);

    ordered.at(-1)!.focus();
    await user.keyboard("{Tab}");
    expect(document.activeElement).toBe(ordered[0]);

    await user.keyboard("{Shift>}{Tab}{/Shift}");
    expect(document.activeElement).toBe(ordered.at(-1));
  });
});

describe("Cart drawer contents", () => {
  it("says so when the bag is empty and offers no checkout", async () => {
    await openBag();

    expect(screen.getByText("Your bag is empty.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: "Checkout" })).toBeNull();
  });

  it("lists what is in the bag with a subtotal", async () => {
    seed(line("dawn-cleanse", "dawn-cleanse", 2), line("freyya-balm:petal", "freyya-balm", 1, "petal"));
    await openBag();

    expect(screen.getByText("Dawn Cleanse")).toBeTruthy();
    expect(screen.getByText("Freyya Balm")).toBeTruthy();
    expect(screen.getByText("Petal")).toBeTruthy();
    expect(screen.getByText("Subtotal").nextElementSibling!.textContent).toBe("$80");
    expect(screen.getByTestId("count").textContent).toBe("3");
  });

  it("shows how far the bag is from free shipping", async () => {
    seed(line("dawn-cleanse", "dawn-cleanse", 1));
    await openBag();

    expect(screen.getByText("Add $47 more for free standard shipping.")).toBeTruthy();
  });

  it("unlocks free shipping at $75", async () => {
    seed(line("golden-hour-serum", "golden-hour-serum", 2));
    await openBag();

    expect(screen.getByText("You've unlocked free standard shipping.")).toBeTruthy();
  });

  it("links to checkout and closes when followed", async () => {
    seed(line("dawn-cleanse", "dawn-cleanse", 1));
    const user = await openBag();

    const checkout = screen.getByRole("link", { name: "Checkout" });
    expect(checkout.getAttribute("href")).toBe("/checkout");

    await user.click(checkout);
    expect(dialog().hasAttribute("inert")).toBe(true);
  });
});

describe("Cart drawer quantities", () => {
  it("raises and lowers a quantity and saves it", async () => {
    seed(line("dawn-cleanse", "dawn-cleanse", 1));
    const user = await openBag();

    await user.click(screen.getByRole("button", { name: "Increase quantity of Dawn Cleanse" }));
    expect(savedCart()[0].quantity).toBe(2);
    expect(screen.getByTestId("count").textContent).toBe("2");

    await user.click(screen.getByRole("button", { name: "Decrease quantity of Dawn Cleanse" }));
    expect(savedCart()[0].quantity).toBe(1);
  });

  it("stops at the stock limit and says so", async () => {
    seed(line("golden-hour-serum", "golden-hour-serum", 2));
    const user = await openBag();
    const increase = () => screen.getByRole("button", { name: "Increase quantity of Golden Hour Serum" }) as HTMLButtonElement;

    expect(screen.queryByText("Maximum available")).toBeNull();
    await user.click(increase());

    expect(savedCart()[0].quantity).toBe(3);
    expect(screen.getByText("Maximum available")).toBeTruthy();
    expect(increase().disabled).toBe(true);
  });

  it("removes an item when its quantity reaches zero", async () => {
    seed(line("dawn-cleanse", "dawn-cleanse", 1));
    const user = await openBag();

    await user.click(screen.getByRole("button", { name: "Decrease quantity of Dawn Cleanse" }));

    expect(savedCart()).toEqual([]);
    expect(screen.getByText("Your bag is empty.")).toBeTruthy();
  });

  it("removes an item with the Remove button", async () => {
    seed(line("dawn-cleanse", "dawn-cleanse", 2), line("veil-spf", "veil-spf", 1));
    const user = await openBag();

    await user.click(screen.getByRole("button", { name: "Remove Dawn Cleanse from bag" }));

    expect(savedCart().map((i: { id: string }) => i.id)).toEqual(["veil-spf"]);
  });

  it("announces quantity changes to screen readers", async () => {
    seed(line("dawn-cleanse", "dawn-cleanse", 1));
    await openBag();

    const quantity = screen.getByText("1", { selector: "span[aria-live]" });
    expect(quantity.getAttribute("aria-live")).toBe("polite");
  });
});
