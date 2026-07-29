'use client';

import { useEffect } from 'react';
import { useAppStore } from '@/lib/store';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useAppStore((s) => s.theme);
  const language = useAppStore((s) => s.language);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.documentElement.lang = language === 'mm' ? 'my' : 'en';
  }, [theme, language]);

  return <>{children}</>;
}
