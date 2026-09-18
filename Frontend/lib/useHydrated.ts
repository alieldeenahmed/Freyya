import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False during server rendering and hydration, true once the browser has taken over.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
