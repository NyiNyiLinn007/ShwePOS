import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// ShwePOS Global State Management (Zustand)
// ============================================

type Language = 'en' | 'mm';
type Theme = 'dark' | 'light';

interface AppState {
  language: Language;
  theme: Theme;
  sidebarCollapsed: boolean;
  lowStockRefreshKey: number;
  setLanguage: (lang: Language) => void;
  toggleLanguage: () => void;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  toggleSidebar: () => void;
  triggerLowStockRefresh: () => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      language: 'en',
      theme: 'dark',
      sidebarCollapsed: false,
      lowStockRefreshKey: 0,
      setLanguage: (language) => set({ language }),
      toggleLanguage: () =>
        set((state) => ({ language: state.language === 'en' ? 'mm' : 'en' })),
      setTheme: (theme) => set({ theme }),
      toggleTheme: () =>
        set((state) => ({ theme: state.theme === 'dark' ? 'light' : 'dark' })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      toggleSidebar: () =>
        set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),
      triggerLowStockRefresh: () =>
        set((state) => ({ lowStockRefreshKey: state.lowStockRefreshKey + 1 })),
    }),
    {
      name: 'shwepos-app-store',
      partialize: (state) => ({
        language: state.language,
        theme: state.theme,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    }
  )
);
