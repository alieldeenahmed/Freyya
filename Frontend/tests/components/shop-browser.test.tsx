// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ShopBrowser from "@/components/ShopBrowser";
import { products } from "@/data/products";
import { navigation, router } from "../mocks/next-navigation";

const names = () => screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
const pressed = () =>
  screen.getAllByRole("button", { pressed: true }).map((b) => b.textContent?.trim());

function renderShop(search = "") {
  navigation.search = search;
  return render(<ShopBrowser products={products} />);
}

describe("Shop filter and sort", () => {
  it("shows the whole catalog in its own order by default", () => {
    renderShop();

    expect(names()).toEqual([
      "Dawn Cleanse",
      "Golden Hour Serum",
      "Second Skin Cream",
      "Veil SPF",
      "Freyya Balm",
      "Dew Drops",
    ]);
    expect(screen.getByRole("status").textContent).toBe("6 products");
    expect(pressed()).toEqual(["All"]);
  });

  it("reads the filter and sort from the URL", () => {
    renderShop("?group=color&sort=price-desc");

    expect(names()).toEqual(["Dew Drops", "Freyya Balm"]);
    expect(screen.getByRole("status").textContent).toBe("2 products");
    expect(pressed()).toEqual(["Color"]);
    expect(document.querySelector("[aria-haspopup=listbox]")!.textContent).toContain(
      "Price: high to low"
    );
  });

  it("splits skincare from color", () => {
    renderShop("?group=skincare");
    expect(names()).toEqual(["Dawn Cleanse", "Golden Hour Serum", "Second Skin Cream", "Veil SPF"]);
  });

  it("falls back to the whole shop for a link with unknown values", () => {
    renderShop("?group=hair&sort=cheapest");

    expect(names()).toHaveLength(6);
    expect(pressed()).toEqual(["All"]);
  });

  it("writes a chosen filter into the URL without adding to history", async () => {
    const user = userEvent.setup();
    renderShop();

    await user.click(screen.getByRole("button", { name: "Color" }));

    expect(router.replace).toHaveBeenCalledWith("/?group=color", { scroll: false });
    expect(router.push).not.toHaveBeenCalled();
  });

  it("keeps the other choice when one changes", async () => {
    const user = userEvent.setup();
    renderShop("?group=color");

    await user.click(document.querySelector<HTMLElement>("[aria-haspopup=listbox]")!);
    await user.click(screen.getByRole("option", { name: "Name" }));

    expect(router.replace).toHaveBeenCalledWith("/?group=color&sort=name", { scroll: false });
  });

  it("leaves default choices out of the URL", async () => {
    const user = userEvent.setup();
    renderShop("?group=color");

    await user.click(screen.getByRole("button", { name: "All" }));

    expect(router.replace).toHaveBeenCalledWith("/", { scroll: false });
  });
});
