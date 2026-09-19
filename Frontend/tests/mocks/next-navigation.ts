import { vi } from "vitest";

// Stands in for next/navigation, which only works inside a running Next.js app.
// Tests read and change this state to drive components.
export const router = {
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
  back: vi.fn(),
  prefetch: vi.fn(),
};

export const navigation = {
  pathname: "/",
  search: "",
};

export function resetNavigation() {
  navigation.pathname = "/";
  navigation.search = "";
  for (const fn of Object.values(router)) fn.mockClear();
}

export const useRouter = () => router;
export const usePathname = () => navigation.pathname;
export const useSearchParams = () => new URLSearchParams(navigation.search);
