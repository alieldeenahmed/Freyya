// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Quiz from "@/components/Quiz";
import { products } from "@/data/products";
import { renderWithProviders } from "../render";

type Answer = string;

async function takeQuiz(answers: Answer[]) {
  const user = userEvent.setup();
  renderWithProviders(<Quiz />);
  for (const answer of answers) {
    await user.click(screen.getByRole("button", { name: answer }));
  }
  return user;
}

const COOL = ["Blue or purple", "Silver or platinum", "Burns before it tans"];
const WARM = ["Green", "Gold", "Tans easily, rarely burns"];

describe("Shade Match quiz", () => {
  it("starts with the product question and counts the steps", () => {
    renderWithProviders(<Quiz />);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Which are we matching today?");
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
    expect(screen.getAllByRole("button").map((b) => b.textContent)).toEqual([
      "Freyya Balm — tinted lip balm",
      "Dew Drops — glow drops",
    ]);
  });

  it("moves through all five questions in order", async () => {
    const user = userEvent.setup();
    renderWithProviders(<Quiz />);

    const steps: [string, string][] = [
      ["Freyya Balm — tinted lip balm", "Look at your wrist. What color are your veins?"],
      ["Green", "Which metal do you reach for?"],
      ["Gold", "How does your skin respond to sun?"],
      ["Tans easily, rarely burns", "How much color do you want?"],
    ];

    for (const [answer, nextPrompt] of steps) {
      await user.click(screen.getByRole("button", { name: answer }));
      expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(nextPrompt);
    }
    expect(screen.getByText("Step 5 of 5")).toBeTruthy();
  });

  it("matches a cool undertone with a subtle finish to Petal", async () => {
    await takeQuiz(["Freyya Balm — tinted lip balm", ...COOL, "Barely there"]);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Petal");
    expect(screen.getByText("Freyya Balm")).toBeTruthy();
    expect(screen.getByAltText("Freyya Balm in Petal")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Shop Freyya Balm" }).getAttribute("href")).toBe(
      "/shop/freyya-balm"
    );
  });

  it("matches a warm undertone with a bold finish to Bronze in the glow drops", async () => {
    await takeQuiz(["Dew Drops — glow drops", ...WARM, "Noticeable"]);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Bronze");
    expect(screen.getByRole("link", { name: "Shop Dew Drops" }).getAttribute("href")).toBe(
      "/shop/dew-drops"
    );
  });

  it("falls back to the other intensity when a combination does not exist", async () => {
    // Dew Drops has no bold cool shade, so a bold cool answer lands on Moonlight.
    await takeQuiz(["Dew Drops — glow drops", ...COOL, "Noticeable"]);

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Moonlight");
  });

  it("lets the shopper start over", async () => {
    const user = await takeQuiz(["Freyya Balm — tinted lip balm", ...COOL, "Barely there"]);

    await user.click(screen.getByRole("button", { name: "Start over" }));

    expect(screen.getByRole("heading", { level: 1 }).textContent).toBe("Which are we matching today?");
    expect(screen.getByText("Step 1 of 5")).toBeTruthy();
  });

  it("only ever recommends a shade that is in the catalog", async () => {
    await takeQuiz(["Freyya Balm — tinted lip balm", ...WARM, "Noticeable"]);

    const shade = screen.getByRole("heading", { level: 1 }).textContent;
    const shades = products.find((p) => p.id === "freyya-balm")!.variants!.map((v) => v.name);
    expect(shades).toContain(shade);
  });
});
