import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

// False on the server and during hydration, true afterwards. Use it to gate UI that
// depends on client-synced catalogue data (Shopify products/collections) inside a
// Suspense boundary, which can hydrate after that data has already arrived.
export function useHydrated() {
  return useSyncExternalStore(subscribe, () => true, () => false);
}
