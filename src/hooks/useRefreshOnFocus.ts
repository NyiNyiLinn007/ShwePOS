'use client';

import { useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Refreshes Next.js server data when:
 * - Browser tab regains visibility (user switches back)
 * - Window regains focus
 * 
 * Uses router.refresh() which re-runs server components
 * and passes fresh props to client components.
 * 
 * Debounced to prevent rapid-fire refreshes.
 */
export function useRefreshOnFocus() {
  const router = useRouter();
  const lastRefreshRef = useRef<number>(Date.now());

  useEffect(() => {
    const DEBOUNCE_MS = 30_000; // Minimum 30s between background focus refreshes

    const refresh = () => {
      const now = Date.now();
      if (now - lastRefreshRef.current > DEBOUNCE_MS) {
        lastRefreshRef.current = now;
        router.refresh();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refresh();
      }
    };

    const handleFocus = () => {
      refresh();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [router]);
}
