import { lazy } from "react";

const RETRY_KEY = "asaankhata:lazy-retry";

export function lazyWithRetry<T extends { default: React.ComponentType<any> }>(
  importer: () => Promise<T>,
  retryKey: string
) {
  return lazy(async () => {
    try {
      sessionStorage.removeItem(`${RETRY_KEY}:${retryKey}`);
      return await importer();
    } catch (error) {
      const storageKey = `${RETRY_KEY}:${retryKey}`;
      const hasRetried = sessionStorage.getItem(storageKey) === "1";

      const message = error instanceof Error ? error.message : String(error);
      const isChunkLoadFailure =
        message.includes("Failed to fetch dynamically imported module") ||
        message.includes("Importing a module script failed") ||
        message.includes("Failed to load module script");

      if (!hasRetried && isChunkLoadFailure) {
        sessionStorage.setItem(storageKey, "1");
        window.location.reload();
      }

      throw error;
    }
  });
}
