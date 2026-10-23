// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import DemoBanner from "@/components/DemoBanner";
import { ApiError } from "@/lib/api";
import { describeCheckoutError } from "@/lib/checkout";
import { DEMO_NOTICE } from "@/lib/demo";

afterEach(() => vi.unstubAllEnvs());

describe("the demo banner", () => {
  it("says what visitors need to know: demo, simulated payments, nightly reset, no real details", () => {
    render(<DemoBanner forceOn />);

    const note = screen.getByRole("note");
    expect(note.textContent).toBe(DEMO_NOTICE);
    expect(note.textContent).toMatch(/Demo store/);
    expect(note.textContent).toMatch(/simulated/);
    expect(note.textContent).toMatch(/every night/);
    expect(note.textContent).toMatch(/real personal information/);
  });

  it("is not there on an ordinary build", () => {
    render(<DemoBanner />);
    expect(screen.queryByRole("note")).toBeNull();
  });

  it("is switched on by NEXT_PUBLIC_DEMO_MODE at build time", async () => {
    vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", "true");
    vi.resetModules();
    const { default: Banner } = await import("@/components/DemoBanner");
    render(<Banner />);
    expect(screen.getByRole("note")).toBeTruthy();
  });

  it("only turns on for exactly 'true'", async () => {
    for (const value of ["1", "TRUE", "yes", "false", ""]) {
      vi.stubEnv("NEXT_PUBLIC_DEMO_MODE", value);
      vi.resetModules();
      const { DEMO_MODE } = await import("@/lib/demo");
      expect(DEMO_MODE, value).toBe(false);
    }
  });
});

describe("demo limits, as a shopper reads them", () => {
  it("passes on the demo's own message when it is full, and allows trying again with the same order", () => {
    const problem = describeCheckoutError(
      new ApiError(429, "demo_capacity", "The demo is busy right now: too many orders are waiting for payment. Please try again in a minute.")
    );
    expect(problem.message).toMatch(/demo is busy/);
    expect(problem.retryable).toBe(true);
    expect(problem.message).not.toMatch(/Too many attempts/);
  });

  it.each([
    ["Too many requests. Try again in 42 seconds.", /wait a minute/],
    ["Too many requests. Try again in 1 second.", /wait a minute/],
    ["Too many requests. Try again in 600 seconds.", /about 10 minutes/],
    ["Too many requests. Try again in 3200 seconds.", /about 54 minutes/],
    ["Too many requests. Try again in 3600 seconds.", /about an hour/],
    ["Rate limit exceeded, retry in 1 minute", /wait a minute/],
    ["", /wait a minute/],
  ])("turns %j into plain advice", (message, expected) => {
    const problem = describeCheckoutError(new ApiError(429, "rate_limited", message));
    expect(problem.message).toMatch(/^Too many attempts\. /);
    expect(problem.message).toMatch(expected);
    expect(problem.retryable).toBe(true);
  });
});
