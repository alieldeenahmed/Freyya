// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ReviewForm from "@/components/ReviewForm";

function setup(shades?: string[]) {
  const onSubmit = vi.fn();
  const onCancel = vi.fn();
  const user = userEvent.setup();
  render(<ReviewForm productId="dawn-cleanse" shades={shades} onSubmit={onSubmit} onCancel={onCancel} />);
  return { user, onSubmit, onCancel };
}

const LONG_ENOUGH = "It rinses clean and leaves my skin soft.";

async function fillIn(user: ReturnType<typeof userEvent.setup>, overrides: { name?: string } = {}) {
  await user.click(screen.getByRole("radio", { name: "4 stars" }));
  await user.type(screen.getByLabelText(/title/i), "  Gentle and soft ");
  await user.type(screen.getByLabelText(/^review/i), LONG_ENOUGH);
  await user.type(screen.getByLabelText(/first name/i), overrides.name ?? "  Sara ");
}

describe("ReviewForm", () => {
  it("explains every missing field and submits nothing", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("button", { name: "Submit review" }));

    const messages = screen.getAllByRole("alert").map((a) => a.textContent);
    expect(messages).toEqual([
      "Choose a star rating.",
      "Give your review a short title.",
      expect.stringContaining("at least 20 characters"),
      "Add your first name.",
    ]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("marks the fields that are wrong", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(screen.getByLabelText(/title/i).getAttribute("aria-invalid")).toBe("true");
    expect(screen.getByLabelText(/first name/i).getAttribute("aria-invalid")).toBe("true");
  });

  it("asks for at least twenty characters in the review itself", async () => {
    const { user, onSubmit } = setup();

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.type(screen.getByLabelText(/title/i), "Nice");
    await user.type(screen.getByLabelText(/^review/i), "Too short");
    await user.type(screen.getByLabelText(/first name/i), "Sara");
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(screen.getAllByRole("alert").map((a) => a.textContent)).toEqual([
      expect.stringContaining("at least 20 characters"),
    ]);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("sends a trimmed review for the right product", async () => {
    const { user, onSubmit } = setup();

    await fillIn(user);
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0]![0]).toMatchObject({
      productId: "dawn-cleanse",
      author: "Sara",
      rating: 4,
      title: "Gentle and soft",
      body: LONG_ENOUGH,
      verified: false,
    });
    expect(onSubmit.mock.calls[0]![0].variant).toBeUndefined();
  });

  it("records the shade when one is chosen", async () => {
    const { user, onSubmit } = setup(["Bare", "Petal"]);

    await fillIn(user);
    await user.click(document.getElementById("review-shade")!);
    await user.click(screen.getByRole("option", { name: "Petal" }));
    await user.click(screen.getByRole("button", { name: "Submit review" }));

    expect(onSubmit.mock.calls[0]![0].variant).toBe("Petal");
  });

  it("only offers a shade picker when the product has shades", () => {
    setup();
    expect(document.getElementById("review-shade")).toBeNull();
  });

  it("lets the shopper cancel", async () => {
    const { user, onCancel } = setup();

    await user.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });
});

describe("star rating input", () => {
  it("is a radio group where exactly one star can be checked", async () => {
    const { user } = setup();

    expect(screen.getByRole("radiogroup", { name: "Your rating" })).toBeTruthy();
    await user.click(screen.getByRole("radio", { name: "3 stars" }));

    const checked = screen.getAllByRole("radio").filter((r) => r.getAttribute("aria-checked") === "true");
    expect(checked.map((r) => r.getAttribute("aria-label"))).toEqual(["3 stars"]);
  });

  it("changes with the arrow keys", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("radio", { name: "3 stars" }));
    await user.keyboard("{ArrowRight}");
    expect(screen.getByRole("radio", { name: "4 stars" }).getAttribute("aria-checked")).toBe("true");

    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "2 stars" }).getAttribute("aria-checked")).toBe("true");
  });

  it("never goes below one or above five", async () => {
    const { user } = setup();

    await user.click(screen.getByRole("radio", { name: "1 star" }));
    await user.keyboard("{ArrowLeft}{ArrowLeft}");
    expect(screen.getByRole("radio", { name: "1 star" }).getAttribute("aria-checked")).toBe("true");

    await user.click(screen.getByRole("radio", { name: "5 stars" }));
    await user.keyboard("{ArrowRight}{ArrowRight}");
    expect(screen.getByRole("radio", { name: "5 stars" }).getAttribute("aria-checked")).toBe("true");
  });
});
