'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Fetches business settings from API on mount and syncs to the global store.
 * Place this inside the dashboard layout so settings are always fresh.
 */
const SETTINGS_FRESH_MS = 5 * 60 * 1000;

export function SettingsInitializer() {
  const updateSettings = useSettingsStore((s) => s.updateSettings);
  const setLoaded = useSettingsStore((s) => s.setLoaded);

  useEffect(() => {
    const { loaded, lastSyncedAt } = useSettingsStore.getState();
    if (loaded && lastSyncedAt && Date.now() - lastSyncedAt < SETTINGS_FRESH_MS) {
      return;
    }

    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        if (res.ok) {
          const data = await res.json();
          updateSettings({
            businessName: data.businessName ?? 'ShwePOS',
            businessNameMm: data.businessNameMm ?? null,
            address: data.address ?? null,
            phone: data.phone ?? null,
            email: data.email ?? null,
            taxRate: data.taxRate ?? 0,
            currencySymbol: data.currencySymbol ?? 'K',
            logo: data.logo ?? null,
            receiptFooter: data.receiptFooter ?? null,
            loyaltyEnabled: data.loyaltyEnabled ?? true,
            loyaltyEarnRate: Number(data.loyaltyEarnRate ?? 1000),
            loyaltyRedeemRate: Number(data.loyaltyRedeemRate ?? 10),
            mobileBankingQrUrl: data.mobileBankingQrUrl ?? null,
            mobileBankingName: data.mobileBankingName ?? 'KBZPay / WavePay',
          });
          setLoaded();
        }
      } catch {
        // Settings will use cached values from localStorage
      }
    };

    fetchSettings();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null; // Renders nothing, just syncs settings
}
