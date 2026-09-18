import { describe, expect, it } from "vitest";
import { QUESTIONS, scoreQuiz, type Answers } from "@/lib/quiz";
import { getProductById } from "@/lib/products";

const PICKS = {
  cool: ["blue", "silver", "burns"],
  warm: ["green", "gold", "tans"],
  neutral: ["both", "either", "mixed"],
};

const answers = (
  product: "balm" | "drops",
  undertone: keyof typeof PICKS,
  intensity: "subtle" | "bold"
): Answers => {
  const [veins, jewelry, sun] = PICKS[undertone];
  return { product, veins, jewelry, sun, intensity };
};

describe("scoreQuiz", () => {
  it.each([
    ["balm", "cool", "subtle", "petal"],
    ["balm", "cool", "bold", "rosewood"],
    ["balm", "warm", "bold", "terracotta"],
    ["balm", "neutral", "subtle", "bare"],
    ["drops", "cool", "subtle", "moonlight"],
    ["drops", "warm", "subtle", "champagne"],
    ["drops", "warm", "bold", "bronze"],
    ["drops", "neutral", "bold", "rose-gold"],
  ] as const)(
    "%s, %s undertone, %s intensity gives %s",
    (product, undertone, intensity, variantId) => {
      expect(scoreQuiz(answers(product, undertone, intensity)).variantId).toBe(variantId);
    }
  );

  it("returns the chosen product", () => {
    expect(scoreQuiz(answers("balm", "cool", "subtle")).productId).toBe("freyya-balm");
    expect(scoreQuiz(answers("drops", "cool", "subtle")).productId).toBe("dew-drops");
  });

  it("goes with the majority undertone", () => {
    const result = scoreQuiz({
      product: "balm",
      veins: "green",
      jewelry: "gold",
      sun: "burns",
      intensity: "bold",
    });
    expect(result.variantId).toBe("terracotta");
  });

  it("breaks a three-way tie towards cool", () => {
    const result = scoreQuiz({
      product: "balm",
      veins: "blue",
      jewelry: "gold",
      sun: "mixed",
      intensity: "subtle",
    });
    expect(result.variantId).toBe("petal");
  });

  it("falls back to the undertone's other shade when the intensity has no match", () => {
    // Dew Drops has no bold cool shade.
    expect(scoreQuiz(answers("drops", "cool", "bold")).variantId).toBe("moonlight");
  });

  it("uses sensible defaults for missing answers", () => {
    expect(scoreQuiz({})).toEqual({ productId: "freyya-balm", variantId: "petal" });
  });

  it("always returns a shade that exists", () => {
    const [product, veins, jewelry, sun, intensity] = QUESTIONS;

    for (const p of product.options) {
      for (const v of veins.options) {
        for (const j of jewelry.options) {
          for (const s of sun.options) {
            for (const i of intensity.options) {
              const result = scoreQuiz({
                product: p.id,
                veins: v.id,
                jewelry: j.id,
                sun: s.id,
                intensity: i.id,
              });
              const variants = getProductById(result.productId)?.variants ?? [];
              expect(variants.some((variant) => variant.id === result.variantId)).toBe(true);
            }
          }
        }
      }
    }
  });
});
