import type { Intensity, Product, Undertone } from "./types";
import { findProduct } from "./products";

export interface QuizOption {
  id: string;
  label: string;
  undertone?: Undertone;
  intensity?: Intensity;
  productId?: "freyya-balm" | "dew-drops";
}

export interface QuizQuestion {
  id: string;
  prompt: string;
  options: QuizOption[];
}

export const QUESTIONS: QuizQuestion[] = [
  {
    id: "product",
    prompt: "Which are we matching today?",
    options: [
      {
        id: "balm",
        label: "Freyya Balm — tinted lip balm",
        productId: "freyya-balm",
      },
      {
        id: "drops",
        label: "Dew Drops — glow drops",
        productId: "dew-drops",
      },
    ],
  },
  {
    id: "veins",
    prompt: "Look at your wrist. What color are your veins?",
    options: [
      { id: "blue", label: "Blue or purple", undertone: "cool" },
      { id: "green", label: "Green", undertone: "warm" },
      { id: "both", label: "Somewhere in between", undertone: "neutral" },
    ],
  },
  {
    id: "jewelry",
    prompt: "Which metal do you reach for?",
    options: [
      { id: "silver", label: "Silver or platinum", undertone: "cool" },
      { id: "gold", label: "Gold", undertone: "warm" },
      { id: "either", label: "Both look right", undertone: "neutral" },
    ],
  },
  {
    id: "sun",
    prompt: "How does your skin respond to sun?",
    options: [
      { id: "burns", label: "Burns before it tans", undertone: "cool" },
      { id: "tans", label: "Tans easily, rarely burns", undertone: "warm" },
      { id: "mixed", label: "A little of both", undertone: "neutral" },
    ],
  },
  {
    id: "intensity",
    prompt: "How much color do you want?",
    options: [
      { id: "subtle", label: "Barely there", intensity: "subtle" },
      { id: "bold", label: "Noticeable", intensity: "bold" },
    ],
  },
];

export type Answers = Record<string, string>;

function findOption(questionId: string, optionId: string): QuizOption | undefined {
  return QUESTIONS.find((q) => q.id === questionId)?.options.find(
    (o) => o.id === optionId
  );
}

export interface QuizResult {
  productId: "freyya-balm" | "dew-drops";
  variantId: string;
}

export function scoreQuiz(answers: Answers, products: Product[]): QuizResult {
  const productOption = findOption("product", answers.product);
  const productId = productOption?.productId ?? "freyya-balm";

  const votes: Record<Undertone, number> = { cool: 0, warm: 0, neutral: 0 };
  for (const questionId of ["veins", "jewelry", "sun"]) {
    const option = findOption(questionId, answers[questionId]);
    if (option?.undertone) votes[option.undertone]++;
  }

  const undertone = (Object.keys(votes) as Undertone[]).reduce((a, b) =>
    votes[b] > votes[a] ? b : a
  );

  const intensityOption = findOption("intensity", answers.intensity);
  const intensity = intensityOption?.intensity ?? "subtle";

  const product = findProduct(products, productId);
  const matches = product?.variants?.filter((v) => v.undertone === undertone) ?? [];
  const variant =
    matches.find((v) => v.intensity === intensity) ??
    matches[0] ??
    product?.variants?.[0];

  return { productId, variantId: variant?.id ?? "" };
}
