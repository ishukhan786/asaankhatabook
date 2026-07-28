import { useEffect, useRef } from "react";

export function useRealtimeRefresh(refresh: () => void | Promise<void>, delayMs = 700) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      void refresh();
    }, delayMs);
  };
}
