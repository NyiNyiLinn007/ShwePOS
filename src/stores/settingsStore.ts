/**
 * @deprecated Use `useAppStore` from '@/lib/store' instead.
 * This re-exports a compatible interface from the main app store
 * to avoid breaking existing imports.
 */
'use client';

import { useAppStore } from '@/lib/store';

interface SettingsStoreState {
  language: string;
  sidebarCollapsed: boolean;
  setLanguage: (lang: 'en' | 'mm') => void;
  toggleSidebar: () => void;
  t: (en: string, mm: string) => string;
}

/** @deprecated Use useAppStore from '@/lib/store' directly */
export function useSettingsStore(): SettingsStoreState {
  const store = useAppStore();
  return {
    language: store.language,
    sidebarCollapsed: store.sidebarCollapsed,
    setLanguage: store.setLanguage,
    toggleSidebar: store.toggleSidebar,
    t: (en: string, mm: string) => (store.language === 'mm' ? mm : en),
  };
}
