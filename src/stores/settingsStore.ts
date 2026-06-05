import { create } from 'zustand';

type Language = 'en' | 'mm';

interface SettingsState {
  language: Language;
  sidebarCollapsed: boolean;
  setLanguage: (lang: Language) => void;
  toggleSidebar: () => void;
  t: (en: string, mm: string) => string;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  language: 'en',
  sidebarCollapsed: false,

  setLanguage: (lang: Language) => set({ language: lang }),

  toggleSidebar: () => set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed })),

  t: (en: string, mm: string) => {
    return get().language === 'mm' ? mm : en;
  },
}));
