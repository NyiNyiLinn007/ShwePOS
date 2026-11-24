'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDate, getMyanmarDateKey } from '@/lib/utils';
import { Tag, Plus, Pencil, Trash2, X, Sparkles } from '@/components/ui/Icons';
import type { PromotionDTO, PromotionType } from '@/types';

interface OptionItem {
  id: string;
  name: string;
  nameMm: string | null;
  sku?: string;
}

interface PromotionsClientProps {
  initialPromotions: PromotionDTO[];
  categories: OptionItem[];
  products: OptionItem[];
}

interface PromoFormState {
  name: string;
  nameMm: string;
  code: string;
  type: PromotionType;
  discountValue: string;
  minSpend: string;
  buyQty: string;
  getQty: string;
  categoryId: string;
  productId: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
  isActive: boolean;
}

function todayIsoDate(): string {
  return getMyanmarDateKey();
}

function nextMonthIsoDate(): string {
  return getMyanmarDateKey(new Date(Date.now() + 30 * 86400_000));
}

const emptyForm = (): PromoFormState => ({
  name: '',
  nameMm: '',
  code: '',
  type: 'PERCENT_OFF',
  discountValue: '10',
  minSpend: '',
  buyQty: '5',
  getQty: '1',
  categoryId: '',
  productId: '',
  startDate: todayIsoDate(),
  endDate: nextMonthIsoDate(),
  usageLimit: '',
  isActive: true,
});

export function PromotionsClient({
  initialPromotions,
  categories,
  products,
}: PromotionsClientProps) {
  const { language, t } = useI18n();
  const { addToast } = useToast();

  const [promotions, setPromotions] = useState<PromotionDTO[]>(initialPromotions);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PromotionDTO | null>(null);
  const [form, setForm] = useState<PromoFormState>(emptyForm);
  const [saving, setSaving] = useState(false);

  function openAdd() {
    setEditing(null);
    setForm(emptyForm());
    setShowModal(true);
  }

  function openEdit(promo: PromotionDTO) {
    setEditing(promo);
    setForm({
      name: promo.name,
      nameMm: promo.nameMm || '',
      code: promo.code || '',
      type: promo.type,
      discountValue: String(promo.discountValue ?? 0),
      minSpend: promo.minSpend !== null && promo.minSpend !== undefined ? String(promo.minSpend) : '',
      buyQty: promo.buyQty !== null && promo.buyQty !== undefined ? String(promo.buyQty) : '5',
      getQty: promo.getQty !== null && promo.getQty !== undefined ? String(promo.getQty) : '1',
      categoryId: promo.categoryId || '',
      productId: promo.productId || '',
      startDate: getMyanmarDateKey(promo.startDate),
      endDate: getMyanmarDateKey(promo.endDate),
      usageLimit: promo.usageLimit !== null && promo.usageLimit !== undefined ? String(promo.usageLimit) : '',
      isActive: promo.isActive,
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.name.trim()) {
      addToast(t('Promotion name is required', 'ပရိုမိုးရှင်းအမည် ထည့်ပါ'), 'error');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        nameMm: form.nameMm.trim() || null,
        code: form.code.trim().toUpperCase() || null,
        type: form.type,
        discountValue: form.type === 'BUY_X_GET_Y' ? 0 : Math.max(0, parseFloat(form.discountValue) || 0),
        minSpend:
          form.type === 'MIN_SPEND_PERCENT' || form.type === 'MIN_SPEND_FIXED'
            ? Math.max(0, parseFloat(form.minSpend) || 0)
            : null,
        buyQty: form.type === 'BUY_X_GET_Y' ? Math.max(1, parseInt(form.buyQty, 10) || 1) : null,
        getQty: form.type === 'BUY_X_GET_Y' ? Math.max(1, parseInt(form.getQty, 10) || 1) : null,
        categoryId:
          form.type === 'MIN_SPEND_PERCENT' || form.type === 'MIN_SPEND_FIXED'
            ? null
            : form.categoryId || null,
        productId:
          form.type === 'MIN_SPEND_PERCENT' || form.type === 'MIN_SPEND_FIXED'
            ? null
            : form.productId || null,
        startDate: form.startDate,
        endDate: form.endDate,
        usageLimit: form.usageLimit.trim() ? Math.max(1, parseInt(form.usageLimit, 10) || 1) : null,
        isActive: form.isActive,
      };

      const url = editing ? `/api/promotions/${editing.id}` : '/api/promotions';
      const method = editing ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to save promotion', 'ပရိုမိုးရှင်းသိမ်းမရပါ'), 'error');
        return;
      }
      if (editing) {
        setPromotions((prev) => prev.map((p) => (p.id === editing.id ? data : p)));
        addToast(t('Promotion updated', 'ပရိုမိုးရှင်း ပြင်ဆင်ပြီးပါပြီ'), 'success');
      } else {
        setPromotions((prev) => [data, ...prev]);
        addToast(t('Promotion created', 'ပရိုမိုးရှင်းအသစ် ဖန်တီးပြီးပါပြီ'), 'success');
      }
      setShowModal(false);
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(promo: PromotionDTO) {
    try {
      const res = await fetch(`/api/promotions/${promo.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to delete promotion', 'ဖျက်မရပါ'), 'error');
        return;
      }
      if (data.deactivated) {
        setPromotions((prev) =>
          prev.map((p) => (p.id === promo.id ? { ...p, isActive: false } : p))
        );
        addToast(
          t('Promotion deactivated (used in past sales)', 'အရောင်းမှတ်တမ်းရှိသဖြင့် ပိတ်ထားလိုက်ပါပြီ'),
          'info'
        );
      } else {
        setPromotions((prev) => prev.filter((p) => p.id !== promo.id));
        addToast(t('Promotion deleted', 'ပရိုမိုးရှင်း ဖျက်ပြီးပါပြီ'), 'success');
      }
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    }
  }

  function getTypeLabel(type: PromotionType) {
    switch (type) {
      case 'PERCENT_OFF':
        return t('Percentage Off (%)', 'ရာခိုင်နှုန်းလျှော့ဈေး (%)');
      case 'FIXED_OFF':
        return t('Fixed Amount Off (K)', 'ငွေပမာဏလျှော့ဈေး (K)');
      case 'BUY_X_GET_Y':
        return t('Buy X Get Y Free', 'X ခုဝယ် Y ခုလက်ဆောင်');
      case 'MIN_SPEND_PERCENT':
        return t('Min Spend % Off', 'အနည်းဆုံးဝယ်ယူမှု % လျှော့');
      case 'MIN_SPEND_FIXED':
        return t('Min Spend Fixed Off', 'အနည်းဆုံးဝယ်ယူမှု K လျှော့');
    }
  }

  function formatRuleSummary(promo: PromotionDTO) {
    if (promo.type === 'PERCENT_OFF') return `${promo.discountValue}% OFF`;
    if (promo.type === 'FIXED_OFF') return `${formatCurrency(promo.discountValue)} OFF`;
    if (promo.type === 'BUY_X_GET_Y') {
      return t(
        `Buy ${promo.buyQty} Get ${promo.getQty} Free`,
        `${promo.buyQty} ခုဝယ် ${promo.getQty} ခုလက်ဆောင်`
      );
    }
    if (promo.type === 'MIN_SPEND_PERCENT') {
      return `${formatCurrency(promo.minSpend ?? 0)}+ → ${promo.discountValue}% OFF`;
    }
    return `${formatCurrency(promo.minSpend ?? 0)}+ → ${formatCurrency(promo.discountValue)} OFF`;
  }

  function getStatusInfo(promo: PromotionDTO) {
    if (!promo.isActive) return { label: t('Inactive', 'ပိတ်ထား'), cls: 'badge-neutral' };
    const now = Date.now();
    const start = new Date(promo.startDate).getTime();
    const end = new Date(promo.endDate).getTime();
    if (promo.usageLimit !== null && promo.usedCount >= promo.usageLimit) {
      return { label: t('Limit Reached', 'ကန့်သတ်ချက်ပြည့်'), cls: 'badge-warning' };
    }
    if (now < start) return { label: t('Scheduled', 'စတင်ရန်စောင့်နေ'), cls: 'badge-info' };
    if (now > end) return { label: t('Expired', 'သက်တမ်းကုန်'), cls: 'badge-danger' };
    return { label: t('Active', 'အသုံးပြုနေ'), cls: 'badge-success' };
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Promotions & Auto-Discounts', 'ပရိုမိုးရှင်းနှင့် အလိုအလျောက်လျှော့ဈေး')}</h1>
          <p className="page-subtitle mm-text">
            {t(
              'Best Single Discount applies automatically at POS checkout (non-stacking)',
              'POS ငွေရှင်းချိန်တွင် အများဆုံးလျှော့ဈေးရမည့် ပရိုမိုးရှင်း ၁ ခုကို အလိုအလျောက်တွက်ပေးပါမည်'
            )}
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={openAdd}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} strokeWidth={2} />
            {t('New Promotion', 'ပရိုမိုးရှင်းအသစ်')}
          </button>
        </div>
      </div>

      <div className="page-body">
        {promotions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Tag size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">{t('No promotions yet', 'ပရိုမိုးရှင်း မရှိသေးပါ')}</div>
            <div className="empty-state-text">
              {t(
                'Create seasonal discounts, Buy X Get Y offers, or promo codes to boost retail sales.',
                'ရာသီပွဲတော်လျှော့ဈေး၊ X ခုဝယ် Y ခုလက်ဆောင် သို့မဟုတ် Promo Code များ ဖန်တီးပါ။'
              )}
            </div>
            <button
              className="btn btn-primary"
              onClick={openAdd}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} strokeWidth={2} />
              {t('New Promotion', 'ပရိုမိုးရှင်းအသစ်')}
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Promotion', 'ပရိုမိုးရှင်း')}</th>
                  <th>{t('Trigger', 'အသုံးပြုပုံ')}</th>
                  <th>{t('Rule', 'စည်းမျဉ်း')}</th>
                  <th>{t('Scope', 'သက်ဆိုင်ရာ')}</th>
                  <th>{t('Valid Period', 'ကာလ')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Used', 'သုံးပြီး')}</th>
                  <th>{t('Status', 'အခြေအနေ')}</th>
                  <th style={{ width: 90 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                </tr>
              </thead>
              <tbody>
                {promotions.map((promo) => {
                  const status = getStatusInfo(promo);
                  return (
                    <tr key={promo.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {language === 'mm' && promo.nameMm ? promo.nameMm : promo.name}
                        </div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {getTypeLabel(promo.type)}
                        </div>
                      </td>
                      <td>
                        {promo.code ? (
                          <code
                            style={{
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 700,
                              background: 'var(--bg-tertiary)',
                              padding: '2px 8px',
                              borderRadius: 'var(--radius-sm)',
                            }}
                          >
                            {promo.code}
                          </code>
                        ) : (
                          <span
                            className="badge badge-primary"
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
                          >
                            <Sparkles size={11} />
                            {t('Auto', 'အလိုအလျောက်')}
                          </span>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatRuleSummary(promo)}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>
                        {promo.product
                          ? `${promo.product.name} (${promo.product.sku})`
                          : promo.category
                            ? promo.category.name
                            : t('Entire Store', 'ဆိုင်တစ်ဆိုင်လုံး')}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>
                        {formatDate(promo.startDate)} – {formatDate(promo.endDate)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {promo.usedCount}
                        {promo.usageLimit ? ` / ${promo.usageLimit}` : ''}
                      </td>
                      <td>
                        <span className={`badge ${status.cls}`}>{status.label}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => openEdit(promo)}
                            title={t('Edit', 'ပြင်ဆင်ရန်')}
                          >
                            <Pencil size={15} strokeWidth={1.75} />
                          </button>
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => handleDelete(promo)}
                            title={t('Delete', 'ဖျက်ရန်')}
                            style={{ color: 'var(--danger)' }}
                          >
                            <Trash2 size={15} strokeWidth={1.75} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showModal && (
        <div className="modal-backdrop" onClick={() => setShowModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 600 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {editing
                  ? t('Edit Promotion', 'ပရိုမိုးရှင်း ပြင်ဆင်ရန်')
                  : t('Create Promotion', 'ပရိုမိုးရှင်းအသစ် ဖန်တီးရန်')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowModal(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
              <div className="input-group">
                <label className="input-label">{t('Name (EN)', 'အမည် (EN)')} *</label>
                <input
                  type="text"
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Thingyan 10% Off"
                />
              </div>
              <div className="input-group">
                <label className="input-label">{t('Name (MM)', 'အမည် (မြန်မာ)')}</label>
                <input
                  type="text"
                  className="input"
                  value={form.nameMm}
                  onChange={(e) => setForm({ ...form, nameMm: e.target.value })}
                  placeholder="သင်္ကြန် ၁၀% လျှော့ဈေး"
                />
              </div>
              <div className="input-group">
                <label className="input-label">{t('Promotion Type', 'ပရိုမိုးရှင်းအမျိုးအစား')}</label>
                <select
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as PromotionType })}
                >
                  <option value="PERCENT_OFF">{t('Percentage Off (%)', 'ရာခိုင်နှုန်းလျှော့ဈေး (%)')}</option>
                  <option value="FIXED_OFF">{t('Fixed Amount Off (K)', 'ငွေပမာဏလျှော့ဈေး (K)')}</option>
                  <option value="BUY_X_GET_Y">{t('Buy X Get Y Free', 'X ခုဝယ် Y ခုလက်ဆောင်')}</option>
                  <option value="MIN_SPEND_PERCENT">{t('Min Spend % Off', 'အနည်းဆုံးဝယ်ယူမှု % လျှော့')}</option>
                  <option value="MIN_SPEND_FIXED">{t('Min Spend Fixed Off', 'အနည်းဆုံးဝယ်ယူမှု K လျှော့')}</option>
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">
                  {t('Promo Code (Leave blank for Auto)', 'Promo Code (ဗလာ = အလိုအလျောက်)')}
                </label>
                <input
                  type="text"
                  className="input"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SAVE10"
                />
              </div>

              {form.type === 'BUY_X_GET_Y' ? (
                <>
                  <div className="input-group">
                    <label className="input-label">{t('Buy Qty (X)', 'ဝယ်ရမည့်အရေအတွက် (X)')} *</label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={form.buyQty}
                      onChange={(e) => setForm({ ...form, buyQty: e.target.value })}
                    />
                  </div>
                  <div className="input-group">
                    <label className="input-label">{t('Get Free Qty (Y)', 'လက်ဆောင်အရေအတွက် (Y)')} *</label>
                    <input
                      type="number"
                      min="1"
                      className="input"
                      value={form.getQty}
                      onChange={(e) => setForm({ ...form, getQty: e.target.value })}
                    />
                  </div>
                </>
              ) : (
                <div className="input-group">
                  <label className="input-label">
                    {form.type === 'PERCENT_OFF' || form.type === 'MIN_SPEND_PERCENT'
                      ? t('Discount (%)', 'လျှော့ဈေး (%)')
                      : t('Discount Amount (MMK)', 'လျှော့ဈေးပမာဏ (ကျပ်)')}{' '}
                    *
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.discountValue}
                    onChange={(e) => setForm({ ...form, discountValue: e.target.value })}
                  />
                </div>
              )}

              {(form.type === 'MIN_SPEND_PERCENT' || form.type === 'MIN_SPEND_FIXED') && (
                <div className="input-group">
                  <label className="input-label">{t('Minimum Spend (MMK)', 'အနည်းဆုံးဝယ်ယူငွေ (ကျပ်)')} *</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={form.minSpend}
                    onChange={(e) => setForm({ ...form, minSpend: e.target.value })}
                    placeholder="50000"
                  />
                </div>
              )}

              {form.type !== 'MIN_SPEND_PERCENT' && form.type !== 'MIN_SPEND_FIXED' && (
                <>
                  <div className="input-group">
                    <label className="input-label">{t('Category Scope (Optional)', 'အမျိုးအစား (ရွေးချယ်)')}</label>
                    <select
                      className="input"
                      value={form.categoryId}
                      onChange={(e) => setForm({ ...form, categoryId: e.target.value, productId: '' })}
                    >
                      <option value="">{t('All Categories', 'အမျိုးအစားအားလုံး')}</option>
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label className="input-label">{t('Specific Product (Optional)', 'သတ်မှတ်ပစ္စည်း (ရွေးချယ်)')}</label>
                    <select
                      className="input"
                      value={form.productId}
                      onChange={(e) => setForm({ ...form, productId: e.target.value, categoryId: '' })}
                    >
                      <option value="">{t('All Products', 'ကုန်ပစ္စည်းအားလုံး')}</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.sku})
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="input-group">
                <label className="input-label">{t('Start Date', 'စတင်ရက်')} *</label>
                <input
                  type="date"
                  className="input"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label className="input-label">{t('End Date', 'ပြီးဆုံးရက်')} *</label>
                <input
                  type="date"
                  className="input"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                />
              </div>
              <div className="input-group">
                <label className="input-label">
                  {t('Usage Limit (Optional)', 'အသုံးပြုနိုင်သည့်အကြိမ်ကန့်သတ်ချက်')}
                </label>
                <input
                  type="number"
                  min="1"
                  className="input"
                  value={form.usageLimit}
                  onChange={(e) => setForm({ ...form, usageLimit: e.target.value })}
                  placeholder={t('Unlimited', 'အကန့်အသတ်မရှိ')}
                />
              </div>
              <div className="input-group" style={{ justifyContent: 'center' }}>
                <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginTop: 18 }}>
                  <input
                    type="checkbox"
                    checked={form.isActive}
                    onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  />
                  <span>{t('Active', 'ဖွင့်ထားမည်')}</span>
                </label>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowModal(false)} disabled={saving}>
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? t('Saving...', 'သိမ်းနေသည်...') : t('Save Promotion', 'သိမ်းဆည်းရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
