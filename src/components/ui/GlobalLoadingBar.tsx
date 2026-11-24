'use client';

import React, { useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { Loader2 } from '@/components/ui/Icons';
import {
  classifyApiRequest,
  isInternalNavigationUrl,
} from '@/lib/loadingTracker';

const API_BAR_DELAY_MS = 150;
const MUTATION_PILL_DELAY_MS = 550;
const NAV_SAFETY_TIMEOUT_MS = 12_000;

export function GlobalLoadingBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { t } = useI18n();

  const [isNavigating, setIsNavigating] = useState(false);
  const [showApiBar, setShowApiBar] = useState(false);
  const [showMutationPill, setShowMutationPill] = useState(false);

  // Progress bar animation state
  const [barVisible, setBarVisible] = useState(false);
  const [progress, setProgress] = useState(0);

  const apiCountRef = useRef(0);
  const mutationCountRef = useRef(0);
  const apiDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutationDelayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navSafetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const routeKey = `${pathname}?${searchParams?.toString() ?? ''}`;

  // Complete navigation state whenever Next.js commits the new route
  useEffect(() => {
    setIsNavigating(false);
    if (navSafetyTimerRef.current) {
      clearTimeout(navSafetyTimerRef.current);
      navSafetyTimerRef.current = null;
    }
  }, [routeKey]);

  // Listen to internal <Link> clicks and browser back/forward navigation
  useEffect(() => {
    const startNav = () => {
      setIsNavigating(true);
      if (navSafetyTimerRef.current) clearTimeout(navSafetyTimerRef.current);
      navSafetyTimerRef.current = setTimeout(() => {
        setIsNavigating(false);
        navSafetyTimerRef.current = null;
      }, NAV_SAFETY_TIMEOUT_MS);
    };

    const handleClick = (event: MouseEvent) => {
      if (
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href]') as HTMLAnchorElement | null;
      if (!anchor) return;
      if (anchor.target && anchor.target !== '_self') return;
      if (anchor.hasAttribute('download')) return;

      const href = anchor.getAttribute('href') || '';
      if (isInternalNavigationUrl(href, window.location.href)) {
        startNav();
      }
    };

    const handlePopState = () => {
      startNav();
    };

    document.addEventListener('click', handleClick, true);
    window.addEventListener('popstate', handlePopState);
    return () => {
      document.removeEventListener('click', handleClick, true);
      window.removeEventListener('popstate', handlePopState);
      if (navSafetyTimerRef.current) clearTimeout(navSafetyTimerRef.current);
    };
  }, []);

  // Intercept same-origin foreground /api/* fetch calls globally
  useEffect(() => {
    const originalFetch = window.fetch.bind(window);

    const handleRequestStart = (kind: 'read' | 'mutation') => {
      apiCountRef.current += 1;
      if (apiCountRef.current === 1 && !apiDelayTimerRef.current) {
        apiDelayTimerRef.current = setTimeout(() => {
          apiDelayTimerRef.current = null;
          if (apiCountRef.current > 0) {
            setShowApiBar(true);
          }
        }, API_BAR_DELAY_MS);
      }

      if (kind === 'mutation') {
        mutationCountRef.current += 1;
        if (mutationCountRef.current === 1 && !mutationDelayTimerRef.current) {
          mutationDelayTimerRef.current = setTimeout(() => {
            mutationDelayTimerRef.current = null;
            if (mutationCountRef.current > 0) {
              setShowMutationPill(true);
            }
          }, MUTATION_PILL_DELAY_MS);
        }
      }
    };

    const handleRequestEnd = (kind: 'read' | 'mutation') => {
      apiCountRef.current = Math.max(0, apiCountRef.current - 1);
      if (apiCountRef.current === 0) {
        if (apiDelayTimerRef.current) {
          clearTimeout(apiDelayTimerRef.current);
          apiDelayTimerRef.current = null;
        }
        setShowApiBar(false);
      }

      if (kind === 'mutation') {
        mutationCountRef.current = Math.max(0, mutationCountRef.current - 1);
        if (mutationCountRef.current === 0) {
          if (mutationDelayTimerRef.current) {
            clearTimeout(mutationDelayTimerRef.current);
            mutationDelayTimerRef.current = null;
          }
          setShowMutationPill(false);
        }
      }
    };

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      let rawUrl = '';
      let method = init?.method;
      if (typeof input === 'string') {
        rawUrl = input;
      } else if (input instanceof URL) {
        rawUrl = input.toString();
      } else if (typeof Request !== 'undefined' && input instanceof Request) {
        rawUrl = input.url;
        if (!method) method = input.method;
      }

      const kind = classifyApiRequest(rawUrl, method, window.location.origin);
      if (kind === 'ignore') {
        return originalFetch(input, init);
      }

      handleRequestStart(kind);
      try {
        return await originalFetch(input, init);
      } finally {
        handleRequestEnd(kind);
      }
    };

    return () => {
      window.fetch = originalFetch;
      if (apiDelayTimerRef.current) {
        clearTimeout(apiDelayTimerRef.current);
        apiDelayTimerRef.current = null;
      }
      if (mutationDelayTimerRef.current) {
        clearTimeout(mutationDelayTimerRef.current);
        mutationDelayTimerRef.current = null;
      }
    };
  }, []);

  const isActive = isNavigating || showApiBar;

  // Smooth trickle progress curve
  useEffect(() => {
    if (isActive) {
      setBarVisible(true);
      setProgress((prev) => (prev < 20 ? 22 : prev));

      const trickle = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 90) return prev;
          const step = prev < 45 ? 12 : prev < 70 ? 6 : 2.5;
          return Math.min(90, prev + step);
        });
      }, 220);

      return () => clearInterval(trickle);
    }

    if (!barVisible) return;

    setProgress(100);
    const hideTimer = setTimeout(() => {
      setBarVisible(false);
    }, 240);
    const resetTimer = setTimeout(() => {
      setProgress(0);
    }, 480);

    return () => {
      clearTimeout(hideTimer);
      clearTimeout(resetTimer);
    };
  }, [isActive, barVisible]);

  // Never show admin progress chrome on secondary customer-facing display
  if (pathname === '/pos/display') {
    return null;
  }

  return (
    <>
      {barVisible && (
        <div
          className="global-progress-track no-print"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progress)}
          aria-label={t('Loading', 'လုပ်ဆောင်နေသည်')}
        >
          <div
            className="global-progress-bar"
            style={{
              width: `${progress}%`,
              opacity: isActive || progress < 100 ? 1 : 0,
            }}
          />
        </div>
      )}

      {showMutationPill && (
        <div className="global-loading-pill no-print" role="status" aria-live="polite">
          <Loader2 size={14} strokeWidth={2.25} className="icon-spin global-loading-pill-icon" />
          <span>{t('Processing...', 'လုပ်ဆောင်နေသည်...')}</span>
        </div>
      )}
    </>
  );
}
