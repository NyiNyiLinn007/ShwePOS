'use client';

import React, { useState } from 'react';
import { useAppStore } from '@/lib/store';
import { useSettingsStore } from '@/store/settingsStore';
import { useToast } from '@/contexts/ToastContext';
import { formatDate } from '@/lib/utils';

/* ---------- Types ---------- */

interface Settings {
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
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  phone: string | null;
  isActive: boolean;
  createdAt: string | Date;
  updatedAt: string | Date;
}

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: string;
  phone: string;
  isActive: boolean;
}

/* ---------- Constants ---------- */

const ROLES = [
  { value: 'ADMIN', en: 'Admin', mm: 'အက်ဒမင်' },
  { value: 'MANAGER', en: 'Manager', mm: 'မန်နေဂျာ' },
  { value: 'CASHIER', en: 'Cashier', mm: 'ငွေကိုင်' },
];

const emptyUserForm: UserFormData = {
  name: '',
  email: '',
  password: '',
  role: 'CASHIER',
  phone: '',
  isActive: true,
};

/* ---------- Component ---------- */

interface SettingsClientProps {
  initialSettings: Settings;
  initialUsers: UserRecord[];
}

export function SettingsClient({
  initialSettings,
  initialUsers,
}: SettingsClientProps) {
  const { language } = useAppStore();
  const { updateSettings, setTaxRate } = useSettingsStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);
  const { addToast } = useToast();

  // ── Business Profile ──────────────────────────────────────
  const [businessName, setBusinessName] = useState(initialSettings.businessName);
  const [businessNameMm, setBusinessNameMm] = useState(initialSettings.businessNameMm || '');
  const [address, setAddress] = useState(initialSettings.address || '');
  const [phone, setPhone] = useState(initialSettings.phone || '');
  const [email, setEmail] = useState(initialSettings.email || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // ── Tax & Currency ────────────────────────────────────────
  const [taxRate, setTaxRateLocal] = useState(String(initialSettings.taxRate));
  const [currencySymbol, setCurrencySymbol] = useState(initialSettings.currencySymbol);
  const [savingTax, setSavingTax] = useState(false);

  // ── Receipt ───────────────────────────────────────────────
  const [receiptFooter, setReceiptFooter] = useState(initialSettings.receiptFooter || '');
  const [savingReceipt, setSavingReceipt] = useState(false);
  const [showReceiptPreview, setShowReceiptPreview] = useState(false);

  // ── Users ─────────────────────────────────────────────────
  const [users, setUsers] = useState<UserRecord[]>(initialUsers);
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [userForm, setUserForm] = useState<UserFormData>(emptyUserForm);
  const [userFormErrors, setUserFormErrors] = useState<Record<string, string>>({});
  const [savingUser, setSavingUser] = useState(false);
  const [deleteUserTarget, setDeleteUserTarget] = useState<UserRecord | null>(null);
  const [deletingUser, setDeletingUser] = useState(false);

  /* ---- Save Handlers ---- */

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
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || 'Failed to save', 'error');
        return;
      }
      // Sync global store so Sidebar, Receipt, POS all update
      updateSettings({
        businessName,
        businessNameMm: businessNameMm || null,
        address: address || null,
        phone: phone || null,
        email: email || null,
      });
      addToast(t('Business profile saved', 'လုပ်ငန်းပရိုဖိုင်သိမ်းပြီး'), 'success');
    } catch {
      addToast('Network error', 'error');
    } finally {
      setSavingProfile(false);
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
        addToast(data.error || 'Failed to save', 'error');
        return;
      }
      setTaxRate(rate);
      updateSettings({ taxRate: rate, currencySymbol });
      addToast(t('Tax & currency saved', 'အခွန်နှင့်ငွေကြေးသိမ်းပြီး'), 'success');
    } catch {
      addToast('Network error', 'error');
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
        addToast(data.error || 'Failed to save', 'error');
        return;
      }
      updateSettings({ receiptFooter: receiptFooter || null });
      addToast(t('Receipt settings saved', 'ပြေစာဆက်တင်သိမ်းပြီး'), 'success');
    } catch {
      addToast('Network error', 'error');
    } finally {
      setSavingReceipt(false);
    }
  }

  /* ---- User Modal Handlers ---- */

  function openAddUser() {
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setUserFormErrors({});
    setShowUserModal(true);
  }

  function openEditUser(user: UserRecord) {
    setEditingUser(user);
    setUserForm({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      phone: user.phone || '',
      isActive: user.isActive,
    });
    setUserFormErrors({});
    setShowUserModal(true);
  }

  function closeUserModal() {
    setShowUserModal(false);
    setEditingUser(null);
    setUserForm(emptyUserForm);
    setUserFormErrors({});
  }

  function handleUserFormChange(field: keyof UserFormData, value: string | boolean) {
    setUserForm((prev) => ({ ...prev, [field]: value }));
    if (userFormErrors[field]) {
      setUserFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
  }

  function validateUserForm(): boolean {
    const errors: Record<string, string> = {};
    if (!userForm.name.trim()) errors.name = 'Name is required';
    if (!userForm.email.trim()) errors.email = 'Email is required';
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (userForm.email && !emailRegex.test(userForm.email)) {
      errors.email = 'Invalid email format';
    }
    if (!editingUser && !userForm.password) {
      errors.password = 'Password is required for new users';
    }
    if (userForm.password && userForm.password.length > 0 && userForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    setUserFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSaveUser() {
    if (!validateUserForm()) return;
    setSavingUser(true);

    try {
      const payload: Record<string, unknown> = {
        name: userForm.name.trim(),
        email: userForm.email.trim(),
        role: userForm.role,
        phone: userForm.phone.trim() || null,
        isActive: userForm.isActive,
      };
      if (userForm.password) {
        payload.password = userForm.password;
      }

      const url = editingUser ? `/api/users/${editingUser.id}` : '/api/users';
      const method = editingUser ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Failed to save user', 'error');
        return;
      }

      if (editingUser) {
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? data : u))
        );
        addToast(t('User updated', 'အသုံးပြုသူအပ်ဒိတ်ပြီး'), 'success');
      } else {
        setUsers((prev) => [data, ...prev]);
        addToast(t('User created', 'အသုံးပြုသူအသစ်ဖန်တီးပြီး'), 'success');
      }

      closeUserModal();
    } catch {
      addToast('Network error', 'error');
    } finally {
      setSavingUser(false);
    }
  }

  async function handleDeleteUser() {
    if (!deleteUserTarget) return;
    setDeletingUser(true);

    try {
      const res = await fetch(`/api/users/${deleteUserTarget.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'Failed to deactivate user', 'error');
        return;
      }

      setUsers((prev) =>
        prev.map((u) =>
          u.id === deleteUserTarget.id ? { ...u, isActive: false } : u
        )
      );
      addToast(t('User deactivated', 'အသုံးပြုသူပိတ်ထားပြီး'), 'success');
      setDeleteUserTarget(null);
    } catch {
      addToast('Network error', 'error');
    } finally {
      setDeletingUser(false);
    }
  }

  function getRoleLabel(role: string): string {
    const r = ROLES.find((ro) => ro.value === role);
    if (!r) return role;
    return language === 'mm' ? r.mm : r.en;
  }

  function getRoleBadgeClass(role: string): string {
    if (role === 'ADMIN') return 'badge-primary';
    if (role === 'MANAGER') return 'badge-success';
    return 'badge-neutral';
  }

  return (
    <>
      {/* Page Header */}
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
            <h3 className="heading-4" style={{ marginBottom: 4 }}>
              🏢 {t('Business Profile', 'လုပ်ငန်းပရိုဖိုင်')}
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
              <label className="input-label">{t('Phone', 'ဖုန်းနံပါတ်')}</label>
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
            <h3 className="heading-4" style={{ marginBottom: 4 }}>
              💲 {t('Tax & Currency', 'အခွန်နှင့်ငွေကြေး')}
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

        {/* Section 3: Receipt */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4 }}>
              🧾 {t('Receipt Settings', 'ပြေစာဆက်တင်များ')}
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
              🌐 {t('Language', 'ဘာသာစကား')}
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
              🇬🇧 English
            </button>
            <button
              className={`btn ${language === 'mm' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => useAppStore.getState().setLanguage('mm')}
            >
              🇲🇲 မြန်မာ
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
              🎨 {t('Theme', 'အပြင်အဆင်')}
            </h3>
            <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
              {t('Switch between Dark and Light mode', 'Dark နှင့် Light မုဒ်ကြားပြောင်းပါ')}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-md)' }}>
            <button
              className={`btn ${useAppStore.getState().theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => useAppStore.getState().setTheme('dark')}
            >
              🌙 {t('Dark Mode', 'Dark မုဒ်')}
            </button>
            <button
              className={`btn ${useAppStore.getState().theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => useAppStore.getState().setTheme('light')}
            >
              ☀️ {t('Light Mode', 'Light မုဒ်')}
            </button>
          </div>
        </div>

        {/* Section 5: User Management */}
        <div className="glass-card" style={{ marginBottom: 'var(--space-xl)' }}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 'var(--space-lg)',
            }}
          >
            <div>
              <h3 className="heading-4" style={{ marginBottom: 4 }}>
                👥 {t('User Management', 'အသုံးပြုသူစီမံခန့်ခွဲရေး')}
              </h3>
              <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                {t('Manage system users and roles', 'အသုံးပြုသူနှင့်ရာထူးများစီမံပါ')}
              </p>
            </div>
            <button className="btn btn-primary btn-sm" onClick={openAddUser}>
              <span>＋</span> {t('Add User', 'အသုံးပြုသူထည့်ရန်')}
            </button>
          </div>

          {users.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">👤</div>
              <div className="empty-state-title">
                {t('No users found', 'အသုံးပြုသူမတွေ့ပါ')}
              </div>
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Name', 'အမည်')}</th>
                    <th>{t('Email', 'အီးမေးလ်')}</th>
                    <th>{t('Role', 'ရာထူး')}</th>
                    <th>{t('Status', 'အခြေအနေ')}</th>
                    <th>{t('Created', 'ဖန်တီးသည့်ရက်')}</th>
                    <th style={{ width: 100 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                          <div
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: '50%',
                              background: 'var(--bg-tertiary)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 14,
                              fontWeight: 700,
                              color: 'var(--primary)',
                            }}
                          >
                            {user.name
                              .split(' ')
                              .map((p) => p[0])
                              .join('')
                              .toUpperCase()
                              .slice(0, 2)}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600 }}>{user.name}</div>
                            {user.phone && (
                              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                                {user.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>{user.email}</td>
                      <td>
                        <span className={`badge ${getRoleBadgeClass(user.role)}`}>
                          {getRoleLabel(user.role)}
                        </span>
                      </td>
                      <td>
                        <span
                          className={`badge ${user.isActive ? 'badge-success' : 'badge-neutral'}`}
                        >
                          {user.isActive
                            ? t('Active', 'အသုံးပြုနေဆဲ')
                            : t('Inactive', 'ပိတ်ထားသည်')}
                        </span>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                        {formatDate(user.createdAt)}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEditUser(user)}
                            title="Edit"
                          >
                            ✏️
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setDeleteUserTarget(user)}
                            title="Deactivate"
                            style={{ color: 'var(--danger)' }}
                          >
                            🗑️
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 6: About */}
        <div className="glass-card">
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3 className="heading-4" style={{ marginBottom: 4 }}>
              ℹ️ {t('About', 'အကြောင်း')}
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
              <div style={{ fontWeight: 600 }}>SQLite (Prisma ORM)</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                {t('Framework', 'ဖရိမ်ဝပ်')}
              </div>
              <div style={{ fontWeight: 600 }}>Next.js 15 (App Router)</div>
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

      {/* Add/Edit User Modal */}
      {showUserModal && (
        <div className="modal-backdrop" onClick={closeUserModal}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editingUser
                  ? t('Edit User', 'အသုံးပြုသူပြင်ဆင်ရန်')
                  : t('Add User', 'အသုံးပြုသူထည့်ရန်')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={closeUserModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {/* Name */}
              <div className="input-group">
                <label className="input-label">{t('Name', 'အမည်')} *</label>
                <input
                  type="text"
                  className={`input ${userFormErrors.name ? 'input-error' : ''}`}
                  placeholder={t('Full name', 'နာမည်အပြည့်အစုံ')}
                  value={userForm.name}
                  onChange={(e) => handleUserFormChange('name', e.target.value)}
                />
                {userFormErrors.name && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {userFormErrors.name}
                  </span>
                )}
              </div>

              {/* Email */}
              <div className="input-group">
                <label className="input-label">{t('Email', 'အီးမေးလ်')} *</label>
                <input
                  type="email"
                  className={`input ${userFormErrors.email ? 'input-error' : ''}`}
                  placeholder="user@example.com"
                  value={userForm.email}
                  onChange={(e) => handleUserFormChange('email', e.target.value)}
                />
                {userFormErrors.email && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {userFormErrors.email}
                  </span>
                )}
              </div>

              {/* Password */}
              <div className="input-group">
                <label className="input-label">
                  {t('Password', 'စကားဝှက်')} {editingUser ? '' : '*'}
                </label>
                <input
                  type="password"
                  className={`input ${userFormErrors.password ? 'input-error' : ''}`}
                  placeholder={
                    editingUser
                      ? t('Leave blank to keep current', 'လက်ရှိအတိုင်းထားရန် ဗလာထားပါ')
                      : t('Minimum 6 characters', 'အနည်းဆုံး ၆ လုံး')
                  }
                  value={userForm.password}
                  onChange={(e) => handleUserFormChange('password', e.target.value)}
                />
                {userFormErrors.password && (
                  <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                    {userFormErrors.password}
                  </span>
                )}
              </div>

              {/* Role */}
              <div className="input-group">
                <label className="input-label">{t('Role', 'ရာထူး')}</label>
                <select
                  className="input"
                  value={userForm.role}
                  onChange={(e) => handleUserFormChange('role', e.target.value)}
                >
                  {ROLES.map((role) => (
                    <option key={role.value} value={role.value}>
                      {language === 'mm' ? role.mm : role.en}
                    </option>
                  ))}
                </select>
              </div>

              {/* Phone */}
              <div className="input-group">
                <label className="input-label">{t('Phone', 'ဖုန်းနံပါတ်')}</label>
                <input
                  type="text"
                  className="input"
                  placeholder="+95 9xxxxxxxx"
                  value={userForm.phone}
                  onChange={(e) => handleUserFormChange('phone', e.target.value)}
                />
              </div>

              {/* Active Toggle */}
              <div className="input-group">
                <label
                  className="input-label"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 'var(--space-sm)',
                    cursor: 'pointer',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={userForm.isActive}
                    onChange={(e) => handleUserFormChange('isActive', e.target.checked)}
                    style={{ width: 18, height: 18, accentColor: 'var(--primary)' }}
                  />
                  {t('Active', 'အသုံးပြုနေဆဲ')}
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={closeUserModal}>
                {t('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSaveUser}
                disabled={savingUser}
              >
                {savingUser
                  ? t('Saving...', 'သိမ်းနေသည်...')
                  : editingUser
                    ? t('Update User', 'အသုံးပြုသူအပ်ဒိတ်ရန်')
                    : t('Create User', 'အသုံးပြုသူဖန်တီးရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete User Confirmation Modal */}
      {deleteUserTarget && (
        <div className="modal-backdrop" onClick={() => setDeleteUserTarget(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 className="modal-title">
                {t('Deactivate User', 'အသုံးပြုသူပိတ်ရန်')}
              </h2>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setDeleteUserTarget(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <p>
                {t(
                  'Are you sure you want to deactivate this user?',
                  'ဤအသုံးပြုသူကိုပိတ်ရန်သေချာပါသလား?'
                )}
              </p>
              <div
                style={{
                  marginTop: 'var(--space-md)',
                  padding: 'var(--space-md)',
                  background: 'var(--bg-tertiary)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ fontWeight: 600 }}>{deleteUserTarget.name}</div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                  {deleteUserTarget.email} — {getRoleLabel(deleteUserTarget.role)}
                </div>
              </div>
              <p
                style={{
                  marginTop: 'var(--space-md)',
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                }}
              >
                {t(
                  'The user will be deactivated but their data will be preserved.',
                  'အသုံးပြုသူကိုပိတ်ထားမည်ဖြစ်သော်လည်း ၎င်းတို့၏ဒေတာကိုထိန်းသိမ်းထားမည်။'
                )}
              </p>
            </div>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteUserTarget(null)}
              >
                {t('Cancel', 'ပယ်ဖျက်ရန်')}
              </button>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--danger)' }}
                onClick={handleDeleteUser}
                disabled={deletingUser}
              >
                {deletingUser
                  ? t('Deactivating...', 'ပိတ်နေသည်...')
                  : t('Deactivate', 'ပိတ်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
