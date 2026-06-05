'use client';

import { useEffect } from 'react';
import { useSettingsStore } from '@/store/settingsStore';

/**
 * Fetches business settings from API on mount and syncs to the global store.
 * Place this inside the dashboard layout so settings are always fresh.
 */
export function SettingsInitializer() {
  const { updateSettings, setLoaded, loaded } = useSettingsStore();

  useEffect(() => {
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
