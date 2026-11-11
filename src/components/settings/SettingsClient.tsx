'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { useToast } from '@/contexts/ToastContext';
import { resizeImageToDataUrl } from '@/lib/image';
import {
  Settings,
  DollarSign,
  Star,
  Receipt,
  Sun,
  Moon,
  Upload,
  Info,
  X,
} from '@/components/ui/Icons';
import {
  UserManagementSection,
  UserRecord,
} from '@/components/settings/UserManagementSection';
import { DataMigrationSection } from '@/components/settings/DataMigrationSection';

/* ---------- Types ---------- */

interface SettingsData {
  id: string;
  businessName: string;
  businessNameMm: string | null;
  address: string | null;
  phone: string | null;
  email: string | null;
  taxRate: number;
  currencySymbol: string;
  logo: string | null;
  receiptFooter: string | null;
  loyaltyEnabled?: boolean;
  loyaltyEarnRate?: number;
  loyaltyRedeemRate?: number;
}

interface SettingsClientProps {
  initialSettings: SettingsData;
  initialUsers: UserRecord[];
}

export function SettingsClient({
  initialSettings,
  initialUsers,
}: SettingsClientProps) {
  const { language, t } = useI18n();
  const { updateSettings, setTaxRate } = useSettingsStore();
  const { addToast } = useToast();

  // ── Business Profile ──────────────────────────────────────
  const [businessName, setBusinessName] = useState(initialSettings.businessName);
  const [businessNameMm, setBusinessNameMm] = useState(initialSettings.businessNameMm || '');
  const [address, setAddress] = useState(initialSettings.address || '');
  const [phone, setPhone] = useState(initialSettings.phone || '');
  const [email, setEmail] = useState(initialSettings.email || '');
  const [logo, setLogo] = useState(initialSettings.logo || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Tax & Currency ────────────────────────────────────────
  const [taxRate, setTaxRateLocal] = useState(String(initialSettings.taxRate));
  const [currencySymbol, setCurrencySymbol] = useState(initialSettings.currencySymbol);
  const [savingTax, setSavingTax] = useState(false);

  // ── Loyalty Program ───────────────────────────────────────
  const [loyaltyEnabled, setLoyaltyEnabled] = useState(initialSettings.loyaltyEnabled ?? true);
  const [loyaltyEarnRate, setLoyaltyEarnRate] = useState(String(initialSettings.loyaltyEarnRate ?? 1000));
  const [loyaltyRedeemRate, setLoyaltyRedeemRate] = useState(String(initialSettings.loyaltyRedeemRate ?? 10));
  const [savingLoyalty, setSavingLoyalty] = useState(false);

  // ── Receipt ───────────────────────────────────────────────
  const [receiptFooter, setReceiptFooter] = useState(initialSettings.receiptFooter || '');
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  // ── Users ─────────────────────────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);

  async function saveProfile() {
    setSavingProfile(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName,
          businessNameMm: businessNameMm || null,
          address: address || null,
          phone: phone || null,
          email: email || null,
          logo: logo || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('saveFailed'), 'error');
        return;
      }
      updateSettings({
        businessName,
        businessNameMm: businessNameMm || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
        logo: logo || null,
      });
      addToast(t('Business profile saved', 'လုပ်ငန်းပရိုဖိုင်သိမ်းပြီး'), 'success');
    } catch {
      addToast(t('networkError'), 'error');
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveLoyalty() {
    const earn = Number(loyaltyEarnRate);
    const redeem = Number(loyaltyRedeemRate);
    if (isNaN(earn) || earn <= 0 || isNaN(redeem) || redeem <= 0) {
      addToast(t('Rates must be positive numbers', 'ပွိုင့်နှုန်းထားများ အပြုကိန်းဖြစ်ရပါမည်'), 'error');
      return;
    }
    setSavingLoyalty(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loyaltyEnabled,
          loyaltyEarnRate: earn,
          loyaltyRedeemRate: redeem,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('saveFailed'), 'error');
        return;
      }
      updateSettings({
        loyaltyEnabled,
        loyaltyEarnRate: earn,
        loyaltyRedeemRate: redeem,
      });
      addToast(t('Loyalty settings saved', 'ပွိုင့်ဆက်တင်များ သိမ်းပြီးပါပြီ'), 'success');
    } catch {
      addToast(t('networkError'), 'error');
    } finally {
      setSavingLoyalty(false);
    }
  }

  async function saveTaxCurrency() {
    const rate = Number(taxRate);
    if (isNaN(rate) || rate < 0 || rate > 100) {
      addToast(t('Tax rate must be 0-100', 'အခွန်နှုန်း ၀-၁၀၀ ဖြစ်ရမည်'), 'error');
      return;
    }
    setSavingTax(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taxRate: rate, currencySymbol }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('saveFailed'), 'error');
        return;
      }
      setTaxRate(rate);
      updateSettings({ taxRate: rate, currencySymbol });
      addToast(t('Tax & currency saved', 'အခွန်နှင့်ငွေကြေးသိမ်းပြီး'), 'success');
    } catch {
      addToast(t('networkError'), 'error');
    } finally {
      setSavingTax(false);
    }
  }

  async function saveReceipt() {
    setSavingReceipt(true);
    try {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ receiptFooter: receiptFooter || null }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('saveFailed'), 'error');
        return;
      }
      updateSettings({ receiptFooter: receiptFooter || null });
      addToast(t('Receipt settings saved', 'ပြေစာဆက်တင်သိမ်းပြီး'), 'success');
    } catch {
      addToast(t('networkError'), 'error');
    } finally {
      setSavingReceipt(false);
    }
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Settings', 'ဆက်တင်များ')}</h1>
          <p className="page-subtitle mm-text">
            {t('Manage your business settings', 'လုပ်ငန်းဆက်တင်များစီမံပါ')}
          </p>
        </div>
      </div>

      <div className="page-body">
        {/* Section 1: Business Profile */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Settings size={18} strokeWidth={1.75} />
              {t('Business Profile', 'လုပ်ငန်းပရိုဖိုင်')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Basic information about your business', 'သင့်လုပ်ငန်းအခြေခံအချက်အလက်')}
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-md)',
            }}
          >
            <div className="input-group">
              <label className="input-label">
                {t('Business Name (English)', 'လုပ်ငန်းအမည် (အင်္ဂလိပ်)')}
              </label>
              <input
                type="text"
                className="input"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                placeholder="ShwePOS"
              />
            </div>
            <div className="input-group">
              <label className="input-label">
                {t('Business Name (Myanmar)', 'လုပ်ငန်းအမည် (မြန်မာ)')}
              </label>
              <input
                type="text"
                className="input mm-text"
                value={businessNameMm}
                onChange={(e) => setBusinessNameMm(e.target.value)}
                placeholder="ရွှေPOS"
              />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">{t('Address', 'လိပ်စာ')}</label>
              <input
                type="text"
                className="input"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                placeholder={t('Business address', 'လုပ်ငန်းလိပ်စာ')}
              />
            </div>
            <div className="input-group">
              <label className="input-label">{t('phone')}</label>
              <input
                type="text"
                className="input"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+95 9xxxxxxxx"
              />
            </div>
            <div className="input-group">
              <label className="input-label">{t('Email', 'အီးမေးလ်')}</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="shop@example.com"
              />
            </div>
            <div className="input-group" style={{ gridColumn: '1 / -1' }}>
              <label className="input-label">{t('Shop Logo', 'ဆိုင်လိုဂို')}</label>
              <div className="flex gap-sm" style={{ alignItems: 'center', flexWrap: 'wrap' }}>
                {logo && (
                  <img
                    src={logo}
                    alt="Logo"
                    style={{
                      width: 44,
                      height: 44,
                      objectFit: 'contain',
                      borderRadius: 6,
                      border: '1px solid var(--border-color)',
                      background: '#fff',
                    }}
                  />
                )}
                <label
                  className="btn btn-secondary btn-sm"
                  style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Upload size={14} strokeWidth={1.75} />
                  {t('Upload Logo', 'လိုဂိုတင်ရန်')}
                  <input
                    type="file"
                    accept="image/*"
                    style={{ display: 'none' }}
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      try {
                        const dataUrl = await resizeImageToDataUrl(file, {
                          maxSize: 200,
                          mimeType: 'image/png',
                          quality: 0.9,
                        });
                        setLogo(dataUrl);
                      } catch {
                        addToast(t('Failed to process image', 'ပုံဖတ်မရပါ'), 'error');
                      }
                    }}
                  />
                </label>
                {logo && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setLogo('')}
                    style={{ color: 'var(--danger)', display: 'inline-flex', alignItems: 'center', gap: 4 }}
                  >
                    <X size={14} strokeWidth={1.75} />
                    {t('Remove', 'ဖယ်ရှားရန်')}
                  </button>
                )}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={saveProfile}
              disabled={savingProfile}
            >
              {savingProfile ? t('Saving...', 'သိမ်းနေသည်...') : t('Save Profile', 'ပရိုဖိုင်သိမ်းရန်')}
            </button>
          </div>
        </div>

        {/* Section 2: Tax & Currency */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <DollarSign size={18} strokeWidth={1.75} />
              {t('Tax & Currency', 'အခွန်နှင့်ငွေကြေး')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Configure tax and currency settings', 'အခွန်နှင့်ငွေကြေးဆက်တင်များ')}
            </p>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-md)',
            }}
          >
            <div className="input-group">
              <label className="input-label">{t('Tax Rate (%)', 'အခွန်နှုန်း (%)')}</label>
              <input
                type="number"
                min="0"
                max="100"
                step="0.1"
                className="input"
                value={taxRate}
                onChange={(e) => setTaxRateLocal(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="input-group">
              <label className="input-label">{t('Currency Symbol', 'ငွေကြေးသင်္ကေတ')}</label>
              <input
                type="text"
                className="input"
                value={currencySymbol}
                onChange={(e) => setCurrencySymbol(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)', maxWidth: 100 }}
              />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={saveTaxCurrency}
              disabled={savingTax}
            >
              {savingTax ? t('Saving...', 'သိမ်းနေသည်...') : t('Save', 'သိမ်းရန်')}
            </button>
          </div>
        </div>

        {/* Section 2b: Loyalty Program */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Star size={18} strokeWidth={1.75} />
              {t('Loyalty Points Program', 'ဖောက်သည် ပွိုင့်အစီအစဉ်')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Configure points earning and redemption rates', 'ဝယ်ယူမှုအလိုက် ပွိုင့်ရရှိနှုန်းနှင့် ပြန်လည်အသုံးပြုနှုန်း သတ်မှတ်ပါ')}
            </p>
          </div>
          <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="input-label" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={loyaltyEnabled}
                onChange={(e) => setLoyaltyEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
              />
              {t('Enable Loyalty Points Program', 'ပွိုင့်အစီအစဉ် ဖွင့်ထားမည်')}
            </label>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-md)',
            }}
          >
            <div className="input-group">
              <label className="input-label">
                {t('Spend Amount per 1 Point (MMK)', '၁ ပွိုင့်ရရှိရန် ဝယ်ယူရမည့်ပမာဏ (ကျပ်)')}
              </label>
              <input
                type="number"
                min="1"
                step="100"
                className="input"
                value={loyaltyEarnRate}
                onChange={(e) => setLoyaltyEarnRate(e.target.value)}
                disabled={!loyaltyEnabled}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="input-group">
              <label className="input-label">
                {t('Discount Value of 1 Point (MMK)', '၁ ပွိုင့်၏ လျှော့ဈေးတန်ဖိုး (ကျပ်)')}
              </label>
              <input
                type="number"
                min="1"
                step="1"
                className="input"
                value={loyaltyRedeemRate}
                onChange={(e) => setLoyaltyRedeemRate(e.target.value)}
                disabled={!loyaltyEnabled}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
          </div>
          <div style={{ marginTop: 'var(--space-lg)', display: 'flex', justifyContent: 'flex-end' }}>
            <button
              className="btn btn-primary"
              onClick={saveLoyalty}
              disabled={savingLoyalty}
            >
              {savingLoyalty ? t('Saving...', 'သိမ်းနေသည်...') : t('Save', 'သိမ်းရန်')}
            </button>
          </div>
        </div>

        {/* Section 3: Receipt */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Receipt size={18} strokeWidth={1.75} />
              {t('Receipt Settings', 'ပြေစာဆက်တင်များ')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Customize your receipt footer text', 'သင့်ပြေစာအောက်ခြေစာသားစိတ်ကြိုက်ပြင်ပါ')}
            </p>
          </div>
          <div className="input-group">
            <label className="input-label">{t('Receipt Footer Text', 'ပြေစာအောက်ခြေစာသား')}</label>
            <textarea
              className="input"
              rows={3}
              value={receiptFooter}
              onChange={(e) => setReceiptFooter(e.target.value)}
              placeholder={t('Thank you for your purchase!', 'ဝယ်ယူမှုအတွက်ကျေးဇူးတင်ပါသည်!')}
              style={{ resize: 'vertical' }}
            />
          </div>
          <div
            style={{
              marginTop: 'var(--space-lg)',
              display: 'flex',
              justifyContent: 'flex-end',
              gap: 'var(--space-sm)',
            }}
          >
            <button
              className="btn btn-secondary"
              onClick={() => setShowReceiptPreview(!showReceiptPreview)}
            >
              {showReceiptPreview
                ? t('Hide Preview', 'ပုံကြိုကြည့်ပိတ်ရန်')
                : t('Preview', 'ပုံကြိုကြည့်ရန်')}
            </button>
            <button
              className="btn btn-primary"
              onClick={saveReceipt}
              disabled={savingReceipt}
            >
              {savingReceipt ? t('Saving...', 'သိမ်းနေသည်...') : t('Save', 'သိမ်းရန်')}
            </button>
          </div>
          {showReceiptPreview && (
            <div
              style={{
                marginTop: 'var(--space-lg)',
                padding: 'var(--space-lg)',
                background: '#fff',
                color: '#000',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'monospace',
                fontSize: 12,
                maxWidth: 320,
                lineHeight: 1.6,
              }}
            >
              <div style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>
                {businessName}
              </div>
              {businessNameMm && (
                <div style={{ textAlign: 'center', fontSize: 11 }}>{businessNameMm}</div>
              )}
              {address && (
                <div style={{ textAlign: 'center', fontSize: 10 }}>{address}</div>
              )}
              {phone && (
                <div style={{ textAlign: 'center', fontSize: 10 }}>Tel: {phone}</div>
              )}
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              <div>INV-20260523-0001</div>
              <div>{new Date().toLocaleString()}</div>
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Sample Item x2</span>
                <span>{currencySymbol} 5,000</span>
              </div>
              <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
                <span>Total</span>
                <span>{currencySymbol} 5,000</span>
              </div>
              {receiptFooter && (
                <>
                  <div style={{ borderTop: '1px dashed #000', margin: '8px 0' }} />
                  <div style={{ textAlign: 'center', fontSize: 10, whiteSpace: 'pre-wrap' }}>
                    {receiptFooter}
                  </div>
                </>
              )}
            </div>
          )}
        </div>

        {/* Section 4: Language */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4 }}>
              {t('Language', 'ဘာသာစကား')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Switch between English and Myanmar', 'အင်္ဂလိပ်နှင့်မြန်မာကြားပြောင်းပါ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <button
              className={`btn ${language === 'en' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => useAppStore.getState().setLanguage('en')}
            >
              English
            </button>
            <button
              className={`btn ${language === 'mm' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => useAppStore.getState().setLanguage('mm')}
            >
              မြန်မာ
            </button>
          </div>
          <div
            style={{
              marginTop: 'var(--space-md)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-muted)',
            }}
          >
            {t(
              'Current: English — All labels and texts will display in English.',
              'လက်ရှိ: မြန်မာ — စာသားအားလုံးမြန်မာဘာသာဖြင့်ပြသပါမည်။'
            )}
          </div>
        </div>

        {/* Section 4b: Theme */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4 }}>
              {t('Theme', 'အပြင်အဆင်')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Switch between Dark and Light mode', 'အမှောင်နှင့် အလင်းမုဒ်ကြား ပြောင်းရန်')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <button
              className={`btn ${useAppStore.getState().theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => useAppStore.getState().setTheme('dark')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Moon size={15} strokeWidth={1.75} />
              {t('darkMode')}
            </button>
            <button
              className={`btn ${useAppStore.getState().theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => useAppStore.getState().setTheme('light')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Sun size={15} strokeWidth={1.75} />
              {t('lightMode')}
            </button>
          </div>
        </div>

        {/* Section 5: User Management */}
        <UserManagementSection users={users} setUsers={setUsers} />

        {/* Section 6: Data Migration */}
        <DataMigrationSection />

        {/* Section 7: About */}
        <div className="glass-card">
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Info size={18} strokeWidth={1.75} />
              {t('About', 'အကြောင်း')}
            </h3>
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-md)',
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                {t('Application', 'အက်ပလီကေးရှင်း')}
              </div>
              <div style={{ fontWeight: 600 }}>ShwePOS</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                {t('Version', 'ဗားရှင်း')}
              </div>
              <div style={{ fontWeight: 600 }}>1.0.0</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                {t('Database', 'ဒေတာဘေ့စ်')}
              </div>
              <div style={{ fontWeight: 600 }}>PostgreSQL (Neon + Prisma)</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                {t('Framework', 'ဖရိမ်ဝပ်')}
              </div>
              <div style={{ fontWeight: 600 }}>Next.js 16 (App Router)</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                {t('Total Users', 'အသုံးပြုသူစုစုပေါင်း')}
              </div>
              <div style={{ fontWeight: 600 }}>{users.length}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                {t('Active Users', 'လက်ရှိအသုံးပြုသူ')}
              </div>
              <div style={{ fontWeight: 600 }}>{users.filter((u) => u.isActive).length}</div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
