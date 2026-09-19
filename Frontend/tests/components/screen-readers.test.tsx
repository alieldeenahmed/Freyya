// @vitest-environment jsdom
// What a screen reader depends on: names, landmarks, announcements and where focus lands.
// These read the same accessibility information a reader is built from. They do not replace
// listening with one (see docs/accessibility-testing.md).
import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CartNotice from "@/components/CartNotice";
import ContactForm from "@/components/ContactForm";
import Header from "@/components/Header";
import NewsletterForm from "@/components/NewsletterForm";
import ProductAccordion from "@/components/ProductAccordion";
import ProductCard from "@/components/ProductCard";
import ProductDetail from "@/components/ProductDetail";
import ProductReviews from "@/components/ProductReviews";
import Quiz from "@/components/Quiz";
import ReviewForm from "@/components/ReviewForm";
import { products } from "@/data/products";
import { useCart } from "@/lib/cart-context";
import { findProduct } from "@/lib/products";
import { getReviews } from "@/lib/reviews";
import { renderWithProviders } from "../render";

const balm = findProduct(products, "freyya-balm")!;
const dawn = findProduct(products, "dawn-cleanse")!;

const seedBag = (...lines: { id: string; productId: string; quantity: number; variantId?: string }[]) =>
  window.localStorage.setItem("freyya:cart", JSON.stringify(lines));

describe("Header", () => {
  it("tells a screen reader how many items the bag holds", () => {
    renderWithProviders(<Header />);
    expect(screen.getByRole("button", { name: "Cart" })).toBeTruthy();
  });

  it("says the count, in the singular and the plural", () => {
    seedBag({ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 1 });
    const { unmount } = renderWithProviders(<Header />);
    expect(screen.getByRole("button", { name: "Cart, 1 item" })).toBeTruthy();
    unmount();

    seedBag({ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 2 });
    renderWithProviders(<Header />);
    expect(screen.getByRole("button", { name: "Cart, 2 items" })).toBeTruthy();
  });

  it("does not read the count out a second time from the badge", () => {
    seedBag({ id: "dawn-cleanse", productId: "dawn-cleanse", quantity: 2 });
    renderWithProviders(<Header />);

    const cart = screen.getByRole("button", { name: "Cart, 2 items" });
    expect(cart.querySelector("[aria-hidden]:not(svg)")?.textContent).toBe("2");
  });

  it("names both navigations, and the menu button points at its menu", () => {
    renderWithProviders(<Header />);

    const navs = screen.getAllByRole("navigation", { hidden: true });
    expect(navs.map((n) => n.getAttribute("aria-label"))).toEqual(["Main", "Main"]);
    const button = screen.getByRole("button", { name: "Open menu" });
    expect(document.getElementById(button.getAttribute("aria-controls")!)).toBe(navs[1]);
  });

  it("closes the mobile menu on Escape and returns focus to its button", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Header />);

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" }).getAttribute("aria-expanded")).toBe("true");

    await user.keyboard("{Escape}");

    const closed = screen.getByRole("button", { name: "Open menu" });
    expect(closed.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(closed);
  });
});

describe("Adding to the bag", () => {
  function AddButton() {
    const { addItem } = useCart();
    return (
      <button
        type="button"
        onClick={() =>
          addItem({
            id: "freyya-balm:petal",
            productId: "freyya-balm",
            variantId: "petal",
            name: "Freyya Balm",
            variantName: "Petal",
            price: 24,
            color: "#E8B4B8",
            image: "/products/freyya-balm-petal.jpg",
            stock: 4,
          })
        }
      >
        Add
      </button>
    );
  }

  it("announces what was added through a region that is always on the page", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AddButton />
        <CartNotice />
      </>
    );
    const region = screen.getByRole("status");
    expect(region.textContent).toBe("");

    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(region.textContent).toBe("Freyya Balm, Petal, added to your bag.");
    expect(region.getAttribute("aria-live")).toBe("polite");
  });

  it("does not announce the same thing twice from the sliding card", async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <>
        <AddButton />
        <CartNotice />
      </>
    );
    await user.click(screen.getByRole("button", { name: "Add" }));

    expect(screen.getAllByRole("status", { hidden: true })).toHaveLength(1);
  });
});

describe("Product page", () => {
  const renderDetail = () =>
    renderWithProviders(<ProductDetail product={balm} reviews={getReviews(balm.id)} />);

  it("groups the swatches under the shade label, and the label follows the choice", async () => {
    const user = userEvent.setup();
    renderDetail();

    const group = screen.getByRole("group", { name: /Shade — Bare/ });
    expect(within(group).getAllByRole("button")).toHaveLength(4);

    await user.click(screen.getByRole("button", { name: "Petal" }));
    expect(screen.getByRole("group", { name: /Shade — Petal/ })).toBeTruthy();
  });

  it("hides the photographs of the shades that are not showing", async () => {
    const user = userEvent.setup();
    renderDetail();

    const wrapper = (shade: string) => screen.getByAltText(`Freyya Balm in ${shade}`).parentElement!;
    expect(wrapper("Bare").hasAttribute("aria-hidden")).toBe(false);
    expect(wrapper("Petal").getAttribute("aria-hidden")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Petal" }));
    expect(wrapper("Petal").hasAttribute("aria-hidden")).toBe(false);
    expect(wrapper("Bare").getAttribute("aria-hidden")).toBe("true");
  });

  it("announces the stock line, which changes with the shade", async () => {
    const user = userEvent.setup();
    renderDetail();

    const stock = screen.getByRole("status");
    expect(stock.textContent).toBe("18 in stock");
    await user.click(screen.getByRole("button", { name: "Petal" }));
    expect(stock.textContent).toBe("Only 4 left");
  });

  it("names the rating button for what it does", () => {
    renderDetail();

    const button = screen.getByRole("button", { name: /Go to reviews/ });
    expect(button.getAttribute("aria-label")).toMatch(/^Rated \d\.\d out of 5 from \d+ reviews?\. Go to reviews$/);
  });

  it("gives closed accordion panels a name, and takes them out of reach", async () => {
    const user = userEvent.setup();
    renderWithProviders(<ProductAccordion details={balm.details} />);

    const panel = (name: string) =>
      document.getElementById(screen.getByRole("button", { name }).getAttribute("aria-controls")!)!;

    expect(panel("Ingredients").hasAttribute("inert")).toBe(false);
    expect(panel("Usage").hasAttribute("inert")).toBe(true);
    expect(panel("Usage").getAttribute("aria-labelledby")).toBe(screen.getByRole("button", { name: "Usage" }).id);

    await user.click(screen.getByRole("button", { name: "Usage" }));
    expect(panel("Usage").hasAttribute("inert")).toBe(false);
  });
});

describe("Product card", () => {
  it("is named once, by its heading, not again by its photograph", () => {
    render(<ProductCard product={dawn} />);

    expect(screen.queryAllByRole("img")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "Dawn Cleanse" })).toBeTruthy();
  });
});

describe("Shade Match", () => {
  it("moves focus to each new question, and to the result", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Quiz />);

    await user.click(screen.getByRole("button", { name: "Dew Drops — glow drops" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));

    for (const answer of ["Green", "Gold", "Tans easily, rarely burns", "Noticeable"]) {
      await user.click(screen.getByRole("button", { name: answer }));
    }
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1, name: "Bronze" }));

    await user.click(screen.getByRole("button", { name: "Start over" }));
    expect(document.activeElement).toBe(screen.getByRole("heading", { level: 1 }));
  });

  it("does not steal focus when the page first loads", () => {
    renderWithProviders(<Quiz />);
    expect(document.activeElement).toBe(document.body);
  });

  it("gives the answers to a question a group named by that question", () => {
    renderWithProviders(<Quiz />);

    const group = screen.getByRole("group", { name: "Which are we matching today?" });
    expect(within(group).getAllByRole("button")).toHaveLength(2);
  });
});

describe("Review form", () => {
  const setup = () => {
    const user = userEvent.setup();
    render(<ReviewForm productId="dawn-cleanse" onSubmit={() => {}} onCancel={() => {}} />);
    return user;
  };

  it("moves focus with the arrow keys, so the reader says the star you land on", async () => {
    const user = setup();

    await user.tab();
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "1 star" }));

    await user.keyboard("{ArrowRight}{ArrowRight}");
    const three = screen.getByRole("radio", { name: "3 stars" });
    expect(document.activeElement).toBe(three);
    expect(three.getAttribute("aria-checked")).toBe("true");

    await user.keyboard("{ArrowLeft}");
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "2 stars" }));
  });

  it("sends focus to the first mistake, starting with the rating", async () => {
    const user = setup();

    await user.click(screen.getByRole("button", { name: "Submit review" }));
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "1 star" }));

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.click(screen.getByRole("button", { name: "Submit review" }));
    expect(document.activeElement).toBe(screen.getByLabelText(/title/i));
  });

  it("ties each message to its field", async () => {
    const user = setup();
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    const title = screen.getByLabelText(/title/i);
    const message = document.getElementById(title.getAttribute("aria-describedby")!)!;
    expect(message.textContent).toBe("Give your review a short title.");
    expect(screen.getByRole("radiogroup", { name: "Your rating" }).getAttribute("aria-describedby")).toBe(
      "review-rating-error"
    );
  });
});

describe("Reviews", () => {
  const renderReviews = () =>
    renderWithProviders(
      <ProductReviews productId="dawn-cleanse" productName="Dawn Cleanse" seeded={getReviews("dawn-cleanse")} />
    );

  it("reads the rating breakdown as sentences, not bare numbers", () => {
    renderReviews();

    const rows = within(screen.getByRole("list", { name: "Rating breakdown" })).getAllByRole("listitem");
    expect(rows).toHaveLength(5);
    expect(rows[0].querySelector(".sr-only")?.textContent).toMatch(/^\d+ reviews? with 5 stars$/);
    expect(rows[4].querySelector(".sr-only")?.textContent).toMatch(/^\d+ reviews? with 1 star$/);
    for (const el of rows[0].querySelectorAll(":scope > span:not(.sr-only)")) {
      expect(el.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("moves focus into the form when it opens, and back to the button on cancel", async () => {
    const user = userEvent.setup();
    renderReviews();
    const trigger = screen.getByRole("button", { name: "Write a review" });

    await user.click(trigger);
    expect(document.activeElement).toBe(screen.getByRole("radio", { name: "1 star" }));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(document.activeElement).toBe(trigger);
  });
});

describe("Contact and newsletter", () => {
  it("moves focus to the thank-you when the contact form is sent", async () => {
    const user = userEvent.setup();
    render(<ContactForm />);

    await user.type(screen.getByLabelText("Name"), "Sara Ali");
    await user.type(screen.getByLabelText("Email"), "sara@example.com");
    await user.type(screen.getByLabelText("Message"), "Is the balm vegan?");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    const thanks = screen.getByRole("status");
    expect(thanks.textContent).toContain("Thank you, Sara.");
    expect(document.activeElement).toBe(thanks);
  });

  it("moves focus to the thank-you when the newsletter is joined", async () => {
    const user = userEvent.setup();
    render(<NewsletterForm />);

    await user.type(screen.getByLabelText("The list"), "sara@example.com");
    await user.click(screen.getByRole("button", { name: "Join" }));

    const thanks = screen.getByRole("status");
    expect(thanks.textContent).toContain("Thank you.");
    expect(document.activeElement).toBe(thanks);
  });
});
