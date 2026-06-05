'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// ============================================
// ShwePOS Business Settings Store
// Holds business profile + tax/currency settings
// Syncs across Receipt, Sidebar, POS, etc.
// ============================================

export interface BusinessSettings {
  businessName: string;
  businessNameMm: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxRate: number;
  currencySymbol: string;
  logo: string | null;
  receiptFooter: string | null;
}

interface SettingsState extends BusinessSettings {
  /** Whether settings have been loaded from API at least once */
  loaded: boolean;

  /** Update all business settings at once */
  updateSettings: (settings: Partial<BusinessSettings>) => void;

  /** Set the tax rate */
  setTaxRate: (rate: number) => void;

  /** Mark settings as loaded */
  setLoaded: () => void;
}

const DEFAULT_SETTINGS: BusinessSettings = {
  businessName: 'ShwePOS',
  businessNameMm: 'ရွှေPOS',
  address: null,
  phone: null,
  email: null,
  taxRate: 0,
  currencySymbol: 'K',
  logo: null,
  receiptFooter: null,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,
      loaded: false,

      updateSettings: (settings) => set((state) => ({ ...state, ...settings })),

      setTaxRate: (rate) => set({ taxRate: Math.max(0, Math.min(100, rate)) }),

      setLoaded: () => set({ loaded: true }),
    }),
    {
      name: 'shwepos-settings',
      partialize: (state) => ({
        businessName: state.businessName,
        businessNameMm: state.businessNameMm,
        address: state.address,
        phone: state.phone,
        email: state.email,
        taxRate: state.taxRate,
        currencySymbol: state.currencySymbol,
        logo: state.logo,
        receiptFooter: state.receiptFooter,
        loaded: state.loaded,
      }),
    }
  )
);
