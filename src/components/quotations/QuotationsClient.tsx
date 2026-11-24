'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { useCartStore } from '@/store/cartStore';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency, formatDate, formatQuantity } from '@/lib/utils';
import { printElementById } from '@/lib/print';
import {
  FileText,
  Plus,
  Printer,
  ShoppingCart,
  Trash2,
  Ban,
  X,
} from '@/components/ui/Icons';
import type { CartItem, ProductUnit, QuotationDTO } from '@/types';

interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

interface ProductOption {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  unit: string;
  categoryId: string;
  imageUrl: string | null;
  sellingPrice: number;
  stockQuantity: number;
  productUnits: ProductUnit[];
}

interface DraftQuoteRow {
  productId: string;
  productUnitId: string;
  quantity: string;
  unitPrice: string;
  discount: string;
}

interface QuotationsClientProps {
  initialQuotations: QuotationDTO[];
  customers: CustomerOption[];
  products: ProductOption[];
  defaultTaxRate: number;
}

function defaultValidDate(): string {
  const d = new Date(Date.now() + 7 * 86400_000 + 6.5 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

export function QuotationsClient({
  initialQuotations,
  customers,
  products,
  defaultTaxRate,
}: QuotationsClientProps) {
  const router = useRouter();
  const { language, t } = useI18n();
  const { addToast } = useToast();
  const businessName = useSettingsStore((s) => s.businessName);
  const businessNameMm = useSettingsStore((s) => s.businessNameMm);
  const businessAddress = useSettingsStore((s) => s.address);
  const businessPhone = useSettingsStore((s) => s.phone);

  const [quotations, setQuotations] = useState<QuotationDTO[]>(initialQuotations);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [printTarget, setPrintTarget] = useState<QuotationDTO | null>(null);

  // Create form state
  const [customerId, setCustomerId] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [validUntil, setValidUntil] = useState(defaultValidDate);
  const [discountStr, setDiscountStr] = useState('0');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<DraftQuoteRow[]>([
    { productId: '', productUnitId: '', quantity: '1', unitPrice: '0', discount: '0' },
  ]);
  const [saving, setSaving] = useState(false);

  const subtotal = rows.reduce((sum, r) => {
    const gross = Math.round((parseFloat(r.quantity) || 0) * (parseFloat(r.unitPrice) || 0));
    const disc = Math.min(gross, Math.max(0, parseFloat(r.discount) || 0));
    return sum + Math.max(0, gross - disc);
  }, 0);
  const discountAmount = Math.min(subtotal, Math.max(0, Math.round(parseFloat(discountStr) || 0)));
  const taxable = Math.max(0, subtotal - discountAmount);
  const taxAmount = Math.round(taxable * (defaultTaxRate / 100));
  const totalAmount = taxable + taxAmount;

  function handleSelectProduct(idx: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              productId,
              productUnitId: '',
              unitPrice: product ? String(product.sellingPrice) : '0',
            }
          : row
      )
    );
  }

  function handleSelectUnit(idx: number, productUnitId: string) {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== idx) return row;
        const product = products.find((p) => p.id === row.productId);
        if (!product) return row;
        if (!productUnitId) {
          return { ...row, productUnitId: '', unitPrice: String(product.sellingPrice) };
        }
        const unit = product.productUnits.find((u) => u.id === productUnitId);
        return {
          ...row,
          productUnitId,
          unitPrice: unit ? String(unit.sellingPrice) : row.unitPrice,
        };
      })
    );
  }

  async function handleCreateQuotation() {
    const validRows = rows.filter((r) => r.productId && (parseFloat(r.quantity) || 0) > 0);
    if (validRows.length === 0) {
      addToast(t('Add at least one product item', 'ကုန်ပစ္စည်း အနည်းဆုံး ၁ ခု ထည့်ပါ'), 'error');
      return;
    }

    setSaving(true);
    try {
      const itemsPayload = validRows.map((r) => {
        const product = products.find((p) => p.id === r.productId);
        const unit = product?.productUnits.find((u) => u.id === r.productUnitId);
        return {
          productId: r.productId,
          quantity: parseFloat(r.quantity) || 1,
          unitName: unit ? unit.unitName : product?.unit || null,
          unitFactor: unit ? unit.conversionFactor : 1,
          unitPrice: parseFloat(r.unitPrice) || 0,
          discount: parseFloat(r.discount) || 0,
        };
      });

      const res = await fetch('/api/quotations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerId: customerId || null,
          customerName: customerId ? null : customerName.trim() || null,
          customerPhone: customerId ? null : customerPhone.trim() || null,
          items: itemsPayload,
          discountAmount,
          taxRate: defaultTaxRate,
          validUntil,
          status: 'SENT',
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to create quotation', 'ကမ်းလှမ်းလွှာ ဖန်တီးမရပါ'), 'error');
        return;
      }
      setQuotations((prev) => [data, ...prev]);
      setShowCreateModal(false);
      setPrintTarget(data);
      setRows([{ productId: '', productUnitId: '', quantity: '1', unitPrice: '0', discount: '0' }]);
      setCustomerId('');
      setCustomerName('');
      setCustomerPhone('');
      setDiscountStr('0');
      setNotes('');
      addToast(t('Quotation created', 'ဈေးနှုန်းကမ်းလှမ်းလွှာ ဖန်တီးပြီးပါပြီ'), 'success');
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleLoadToPos(quote: QuotationDTO) {
    const cartItems: CartItem[] = [];
    for (const item of quote.items ?? []) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod) continue;
      const matchedUnit = item.unitName
        ? prod.productUnits.find((u) => u.unitName === item.unitName) ?? null
        : null;
      cartItems.push({
        productId: prod.id,
        categoryId: prod.categoryId,
        name: prod.name,
        nameMm: prod.nameMm,
        sku: prod.sku,
        unitPrice: item.unitPrice,
        originalUnitPrice: matchedUnit ? matchedUnit.sellingPrice : prod.sellingPrice,
        baseSellingPrice: prod.sellingPrice,
        quantity: item.quantity,
        discount: item.discount || 0,
        maxStock: prod.stockQuantity,
        unit: item.unitName || prod.unit,
        baseUnit: prod.unit,
        productUnitId: matchedUnit?.id ?? null,
        unitFactor: item.unitFactor || 1,
        availableUnits: prod.productUnits,
        imageUrl: prod.imageUrl,
      });
    }

    if (cartItems.length === 0) {
      addToast(t('No active products available to load', 'POS ထဲထည့်ရန် ပစ္စည်းမရှိပါ'), 'error');
      return;
    }

    useCartStore.getState().loadQuotationItems(quote.id, cartItems, quote.discountAmount || 0);
    addToast(
      t(
        `Loaded ${quote.quoteNumber} into POS Cart`,
        `${quote.quoteNumber} ကို POS ဈေးခြင်းထဲ ထည့်ပြီးပါပြီ`
      ),
      'success'
    );
    router.push('/pos');
  }

  async function handleCancelQuotation(id: string) {
    try {
      const res = await fetch(`/api/quotations/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to cancel quotation', 'ပယ်ဖျက်မရပါ'), 'error');
        return;
      }
      setQuotations((prev) => prev.map((q) => (q.id === id ? data : q)));
      addToast(t('Quotation cancelled', 'ပယ်ဖျက်ပြီးပါပြီ'), 'info');
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    }
  }

  function getStatusBadge(q: QuotationDTO) {
    const expired =
      q.status !== 'CONVERTED' &&
      q.status !== 'CANCELLED' &&
      new Date(q.validUntil).getTime() < Date.now();
    if (q.status === 'CONVERTED') return { label: t('Converted', 'အရောင်းပြောင်းပြီး'), cls: 'badge-success' };
    if (q.status === 'CANCELLED') return { label: t('Cancelled', 'ပယ်ဖျက်ပြီး'), cls: 'badge-danger' };
    if (expired || q.status === 'EXPIRED') return { label: t('Expired', 'သက်တမ်းကုန်'), cls: 'badge-warning' };
    return { label: t('Active Quote', 'အသုံးပြုနိုင်'), cls: 'badge-primary' };
  }

  return (
    <>
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Quotations & Proforma', 'ဈေးနှုန်းကမ်းလှမ်းလွှာများ')}</h1>
          <p className="page-subtitle mm-text">
            {t(
              'Prepare A4 Proforma Quotations for wholesale buyers and convert to POS sale in 1 click',
              'လက္ကား/ကုမ္ပဏီဖောက်သည်များအတွက် A4 ဈေးနှုန်းကမ်းလှမ်းလွှာ ထုတ်ပေးပြီး တစ်ချက်နှိပ်ရုံဖြင့် POS အရောင်းပြောင်းနိုင်ပါသည်'
            )}
          </p>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => setShowCreateModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Plus size={16} strokeWidth={2} />
            {t('New Quotation', 'ကမ်းလှမ်းလွှာအသစ်')}
          </button>
        </div>
      </div>

      <div className="page-body">
        {quotations.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <FileText size={28} strokeWidth={1.5} />
            </div>
            <div className="empty-state-title">{t('No quotations yet', 'ကမ်းလှမ်းလွှာ မရှိသေးပါ')}</div>
            <div className="empty-state-text">
              {t(
                'Create your first Proforma Quotation to share pricing with corporate or wholesale customers.',
                'လက္ကား/ကုမ္ပဏီဖောက်သည်များအတွက် ပထမဆုံး ဈေးနှုန်းကမ်းလှမ်းလွှာ ဖန်တီးပါ။'
              )}
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setShowCreateModal(true)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Plus size={16} strokeWidth={2} />
              {t('New Quotation', 'ကမ်းလှမ်းလွှာအသစ်')}
            </button>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>{t('Quote #', 'အမှတ်စဉ်')}</th>
                  <th>{t('Customer', 'ဖောက်သည်')}</th>
                  <th>{t('Items', 'ပစ္စည်း')}</th>
                  <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                  <th>{t('Valid Until', 'သက်တမ်းကုန်ရက်')}</th>
                  <th>{t('Status', 'အခြေအနေ')}</th>
                  <th style={{ width: 150 }}>{t('Actions', 'လုပ်ဆောင်ချက်')}</th>
                </tr>
              </thead>
              <tbody>
                {quotations.map((q) => {
                  const badge = getStatusBadge(q);
                  return (
                    <tr key={q.id}>
                      <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        {q.quoteNumber}
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>
                          {q.customer?.name || q.customerName || t('Walk-in', 'လက်လီဝယ်သူ')}
                        </div>
                        {(q.customer?.phone || q.customerPhone) && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {q.customer?.phone || q.customerPhone}
                          </div>
                        )}
                      </td>
                      <td style={{ fontFamily: 'var(--font-mono)' }}>{q.items?.length ?? 0}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatCurrency(q.totalAmount)}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>{formatDate(q.validUntil)}</td>
                      <td>
                        <span className={`badge ${badge.cls}`}>{badge.label}</span>
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setPrintTarget(q)}
                            title={t('Print A4 Quotation', 'A4 ကမ်းလှမ်းလွှာ ထုတ်ရန်')}
                          >
                            <Printer size={15} strokeWidth={1.75} />
                          </button>
                          {q.status !== 'CONVERTED' && q.status !== 'CANCELLED' && (
                            <>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleLoadToPos(q)}
                                title={t('Convert to POS Sale', 'POS အရောင်းသို့ ပြောင်းရန်')}
                                style={{ color: 'var(--success)' }}
                              >
                                <ShoppingCart size={15} strokeWidth={1.75} />
                              </button>
                              <button
                                className="btn btn-ghost btn-sm"
                                onClick={() => handleCancelQuotation(q.id)}
                                title={t('Cancel', 'ပယ်ဖျက်ရန်')}
                                style={{ color: 'var(--danger)' }}
                              >
                                <Ban size={15} strokeWidth={1.75} />
                              </button>
                            </>
                          )}
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

      {/* Create Quotation Modal */}
      {showCreateModal && (
        <div className="modal-backdrop" onClick={() => setShowCreateModal(false)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 780 }}>
            <div className="modal-header">
              <h2 className="modal-title">{t('Create Quotation', 'ဈေးနှုန်းကမ်းလှမ်းလွှာအသစ်')}</h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowCreateModal(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-sm)' }}>
                <div className="input-group">
                  <label className="input-label">{t('Saved Customer', 'ဖောက်သည်ရွေးရန်')}</label>
                  <select
                    className="input"
                    value={customerId}
                    onChange={(e) => setCustomerId(e.target.value)}
                  >
                    <option value="">{t('-- Custom / Walk-in --', '-- အသစ်ရိုက်ထည့်ရန် --')}</option>
                    {customers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} {c.phone ? `(${c.phone})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
                {!customerId && (
                  <>
                    <div className="input-group">
                      <label className="input-label">{t('Company / Name', 'ကုမ္ပဏီ / အမည်')}</label>
                      <input
                        type="text"
                        className="input"
                        value={customerName}
                        onChange={(e) => setCustomerName(e.target.value)}
                        placeholder={t('Buyer name', 'ဝယ်သူအမည်')}
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">{t('Phone', 'ဖုန်း')}</label>
                      <input
                        type="text"
                        className="input"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value)}
                        placeholder="09-xxxxxxx"
                      />
                    </div>
                  </>
                )}
                <div className="input-group">
                  <label className="input-label">{t('Valid Until', 'သက်တမ်းကုန်ရက်')} *</label>
                  <input
                    type="date"
                    className="input"
                    value={validUntil}
                    onChange={(e) => setValidUntil(e.target.value)}
                  />
                </div>
              </div>

              {/* Line Items */}
              <div>
                <div className="flex justify-between items-center" style={{ marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, fontSize: 'var(--text-sm)' }}>
                    {t('Quotation Items', 'ပစ္စည်းစာရင်း')}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() =>
                      setRows((prev) => [
                        ...prev,
                        { productId: '', productUnitId: '', quantity: '1', unitPrice: '0', discount: '0' },
                      ])
                    }
                  >
                    + {t('Add Item', 'ပစ္စည်းထပ်ထည့်')}
                  </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {rows.map((row, idx) => {
                    const product = products.find((p) => p.id === row.productId);
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 80px 100px 90px 32px',
                          gap: 6,
                          alignItems: 'center',
                        }}
                      >
                        <select
                          className="input"
                          value={row.productId}
                          onChange={(e) => handleSelectProduct(idx, e.target.value)}
                        >
                          <option value="">{t('Select product...', 'ပစ္စည်းရွေးပါ...')}</option>
                          {products.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.name} ({p.sku})
                            </option>
                          ))}
                        </select>
                        <select
                          className="input"
                          value={row.productUnitId}
                          disabled={!product || product.productUnits.length === 0}
                          onChange={(e) => handleSelectUnit(idx, e.target.value)}
                        >
                          <option value="">{product?.unit || 'pcs'}</option>
                          {(product?.productUnits ?? []).map((u) => (
                            <option key={u.id} value={u.id}>
                              {u.unitName} (×{u.conversionFactor})
                            </option>
                          ))}
                        </select>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          className="input"
                          value={row.quantity}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r))
                            )
                          }
                          placeholder="Qty"
                        />
                        <input
                          type="number"
                          min="0"
                          className="input"
                          value={row.unitPrice}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, unitPrice: e.target.value } : r))
                            )
                          }
                          placeholder="Price"
                        />
                        <input
                          type="number"
                          min="0"
                          className="input"
                          value={row.discount}
                          onChange={(e) =>
                            setRows((prev) =>
                              prev.map((r, i) => (i === idx ? { ...r, discount: e.target.value } : r))
                            )
                          }
                          placeholder="Disc"
                        />
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          disabled={rows.length <= 1}
                          onClick={() => setRows((prev) => prev.filter((_, i) => i !== idx))}
                          style={{ color: 'var(--danger)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
                <div className="input-group">
                  <label className="input-label">{t('Overall Discount (MMK)', 'စုစုပေါင်းလျှော့ဈေး (ကျပ်)')}</label>
                  <input
                    type="number"
                    min="0"
                    className="input"
                    value={discountStr}
                    onChange={(e) => setDiscountStr(e.target.value)}
                  />
                </div>
                <div className="input-group">
                  <label className="input-label">{t('Notes / Terms', 'မှတ်စု / စည်းကမ်းချက်')}</label>
                  <input
                    type="text"
                    className="input"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder={t('e.g. Delivery within 2 days', 'ဥပမာ ၂ ရက်အတွင်း ပို့ဆောင်ပေးမည်')}
                  />
                </div>
              </div>

              <div
                style={{
                  padding: 'var(--space-md)',
                  background: 'var(--bg-secondary)',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                  {t('Subtotal', 'စုစုပေါင်း')}: {formatCurrency(subtotal)} ·{' '}
                  {t('Tax', 'အခွန်')} ({defaultTaxRate}%): {formatCurrency(taxAmount)}
                </div>
                <div style={{ fontSize: 'var(--text-xl)', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(totalAmount)}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={saving}>
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button className="btn btn-primary" onClick={handleCreateQuotation} disabled={saving}>
                {saving ? t('Saving...', 'သိမ်းနေသည်...') : t('Create & Preview', 'ဖန်တီးပြီး ကြည့်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* A4 Proforma Quotation Print Modal */}
      {printTarget && (
        <div className="modal-backdrop" onClick={() => setPrintTarget(null)}>
          <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 740 }}>
            <div className="modal-header">
              <h2 className="modal-title">
                {t('Proforma Quotation', 'ဈေးနှုန်းကမ်းလှမ်းလွှာ')} — {printTarget.quoteNumber}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setPrintTarget(null)}>
                <X size={16} />
              </button>
            </div>
            <div className="modal-body">
              <div
                id="quotation-a4-print"
                style={{
                  background: '#ffffff',
                  color: '#000000',
                  padding: 28,
                  border: '1px solid var(--border-color)',
                  borderRadius: 'var(--radius-md)',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 14, marginBottom: 16 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800 }}>
                      {businessName} {businessNameMm ? `(${businessNameMm})` : ''}
                    </div>
                    {businessAddress && <div style={{ fontSize: 12, color: '#334155' }}>{businessAddress}</div>}
                    {businessPhone && <div style={{ fontSize: 12, color: '#334155' }}>Tel: {businessPhone}</div>}
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#b45309' }}>
                      {t('QUOTATION / PROFORMA', 'ဈေးနှုန်းကမ်းလှမ်းလွှာ')}
                    </div>
                    <div style={{ fontSize: 12, fontFamily: 'monospace', fontWeight: 700 }}>{printTarget.quoteNumber}</div>
                    <div style={{ fontSize: 11, color: '#475569' }}>
                      {t('Date', 'ရက်စွဲ')}: {formatDate(printTarget.createdAt)} ·{' '}
                      {t('Valid Until', 'သက်တမ်း')}: {formatDate(printTarget.validUntil)}
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 14, fontSize: 12 }}>
                  <strong>{t('Prepared For', 'လက်ခံသူ')}:</strong>{' '}
                  {printTarget.customer?.name || printTarget.customerName || t('Walk-in Customer', 'ဝယ်ယူသူ')}
                  {(printTarget.customer?.phone || printTarget.customerPhone) &&
                    ` (${printTarget.customer?.phone || printTarget.customerPhone})`}
                </div>

                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, marginBottom: 16 }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9', borderBottom: '1px solid #0f172a' }}>
                      <th style={{ padding: 6, textAlign: 'left' }}>#</th>
                      <th style={{ padding: 6, textAlign: 'left' }}>{t('Item Description', 'ပစ္စည်းအမည်')}</th>
                      <th style={{ padding: 6, textAlign: 'right' }}>{t('Qty', 'အရေအတွက်')}</th>
                      <th style={{ padding: 6, textAlign: 'right' }}>{t('Unit Price', 'တစ်ခုဈေး')}</th>
                      <th style={{ padding: 6, textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(printTarget.items ?? []).map((item, i) => (
                      <tr key={item.id} style={{ borderBottom: '1px solid #e2e8f0' }}>
                        <td style={{ padding: 6 }}>{i + 1}</td>
                        <td style={{ padding: 6 }}>
                          <div style={{ fontWeight: 600 }}>
                            {language === 'mm' && item.product?.nameMm
                              ? item.product.nameMm
                              : item.product?.name}
                          </div>
                          {item.product?.sku && (
                            <div style={{ fontSize: 10, color: '#64748b' }}>{item.product.sku}</div>
                          )}
                        </td>
                        <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatQuantity(item.quantity, item.unitName || item.product?.unit)}{' '}
                          {item.unitName || item.product?.unit}
                        </td>
                        <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace' }}>
                          {formatCurrency(item.unitPrice)}
                        </td>
                        <td style={{ padding: 6, textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                          {formatCurrency(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ maxWidth: 280, marginLeft: 'auto', fontSize: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                    <span>{t('Subtotal', 'စုစုပေါင်း')}</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(printTarget.subtotal)}</span>
                  </div>
                  {printTarget.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: '#b91c1c' }}>
                      <span>{t('Discount', 'လျှော့ဈေး')}</span>
                      <span style={{ fontFamily: 'monospace' }}>−{formatCurrency(printTarget.discountAmount)}</span>
                    </div>
                  )}
                  {printTarget.taxAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0' }}>
                      <span>{t('Tax', 'အခွန်')}</span>
                      <span style={{ fontFamily: 'monospace' }}>{formatCurrency(printTarget.taxAmount)}</span>
                    </div>
                  )}
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      padding: '8px 0 0',
                      marginTop: 6,
                      borderTop: '2px solid #0f172a',
                      fontSize: 15,
                      fontWeight: 800,
                    }}
                  >
                    <span>{t('GRAND TOTAL', 'စုစုပေါင်းကျသင့်ငွေ')}</span>
                    <span style={{ fontFamily: 'monospace' }}>{formatCurrency(printTarget.totalAmount)}</span>
                  </div>
                </div>

                {printTarget.notes && (
                  <div style={{ marginTop: 16, fontSize: 11, color: '#334155', borderTop: '1px dashed #cbd5e1', paddingTop: 8 }}>
                    <strong>{t('Terms / Notes', 'စည်းကမ်းချက် / မှတ်စု')}:</strong> {printTarget.notes}
                  </div>
                )}
              </div>
            </div>
            <div className="modal-footer">
              {printTarget.status !== 'CONVERTED' && printTarget.status !== 'CANCELLED' && (
                <button
                  className="btn btn-success"
                  onClick={() => handleLoadToPos(printTarget)}
                  style={{ marginRight: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <ShoppingCart size={15} />
                  {t('Load to POS Cart', 'POS ဈေးခြင်းထဲ ထည့်ရောင်းရန်')}
                </button>
              )}
              <button className="btn btn-secondary" onClick={() => setPrintTarget(null)}>
                {t('Close', 'ပိတ်ရန်')}
              </button>
              <button
                className="btn btn-primary"
                onClick={() =>
                  printElementById('quotation-a4-print', {
                    title: `${printTarget.quoteNumber} - Quotation`,
                    paperSize: 'A4',
                  })
                }
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Printer size={15} />
                {t('Print A4', 'A4 ပရင့်ထုတ်ရန်')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
