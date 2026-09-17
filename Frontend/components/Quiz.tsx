"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { gsap } from "@/lib/gsap";
import { prefersReducedMotion } from "@/lib/motion";
import { QUESTIONS, scoreQuiz, type Answers } from "@/lib/quiz";
import { getProductById } from "@/lib/products";

export default function Quiz() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Answers>({});
  const stepRef = useRef<HTMLDivElement>(null);
  const isResult = step === QUESTIONS.length;

  useEffect(() => {
    const el = stepRef.current;
    if (!el || prefersReducedMotion()) return;

    gsap.fromTo(
      el,
      { opacity: 0, x: 16 },
      { opacity: 1, x: 0, duration: 0.5, ease: "power2.out" }
    );
  }, [step]);

  const goToStep = (next: number) => {
    const el = stepRef.current;

    if (!el || prefersReducedMotion()) {
      setStep(next);
      return;
    }

    gsap.to(el, {
      opacity: 0,
      x: -16,
      duration: 0.3,
      ease: "power2.in",
      onComplete: () => setStep(next),
    });
  };

  const handleSelect = (questionId: string, optionId: string) => {
    setAnswers((prev) => ({ ...prev, [questionId]: optionId }));
    goToStep(step + 1);
  };

  const restart = () => {
    setAnswers({});
    goToStep(0);
  };

  const result = isResult ? scoreQuiz(answers) : null;
  const resultProduct = result ? getProductById(result.productId) : null;
  const resultVariant = resultProduct?.variants?.find(
    (v) => v.id === result?.variantId
  );

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 py-24 sm:px-10">
      <div className="w-full max-w-lg">
        {!isResult && (
          <p className="mb-8 text-center text-xs uppercase tracking-widest text-text/50">
            Step {step + 1} of {QUESTIONS.length}
          </p>
        )}

        <div ref={stepRef}>
          {!isResult ? (
            <div>
              <h1 className="text-center font-serif text-3xl text-text sm:text-4xl">
                {QUESTIONS[step].prompt}
              </h1>
              <div className="mt-10 flex flex-col gap-3">
                {QUESTIONS[step].options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => handleSelect(QUESTIONS[step].id, option.id)}
                    className="border border-secondary/50 px-6 py-4 text-left text-text transition-colors hover:border-accent hover:text-accent"
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ) : resultProduct && resultVariant ? (
            <div className="text-center">
              <p className="text-xs uppercase tracking-widest text-text/50">
                Your match
              </p>
              <div
                className="mx-auto mt-6 h-24 w-24 rounded-full"
                style={{ background: resultVariant.hex }}
              />
              <h1 className="mt-6 font-serif text-3xl text-text sm:text-4xl">
                {resultVariant.name}
              </h1>
              <p className="mt-2 text-text/70">{resultProduct.name}</p>

              <Link
                href={`/shop/${resultProduct.id}`}
                className="mt-10 inline-block border border-text px-8 py-3 text-sm uppercase tracking-widest text-text transition-colors hover:border-accent hover:text-accent"
              >
                Shop {resultProduct.name}
              </Link>

              <button
                type="button"
                onClick={restart}
                className="mt-6 block w-full text-sm uppercase tracking-widest text-text/50 transition-colors hover:text-accent"
              >
                Start over
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
