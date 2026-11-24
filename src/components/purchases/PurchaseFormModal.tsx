'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency } from '@/lib/utils';
import { Plus, Trash2, X, ShoppingBag } from '@/components/ui/Icons';

export interface PurchasePrefillItem {
  productId: string;
  quantity: number;
  unitCost: number;
}

export interface PurchaseSupplierOption {
  id: string;
  name: string;
  phone: string | null;
}

export interface PurchaseProductOption {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  unit: string;
  costPrice: number;
  stockQuantity: number;
}

interface LineRow {
  productId: string;
  quantity: string;
  unitCost: string;
  batchNumber: string;
  expiryDate: string;
}

interface PurchaseFormModalProps {
  isOpen: boolean;
  suppliers: PurchaseSupplierOption[];
  products: PurchaseProductOption[];
  prefillItems?: PurchasePrefillItem[] | null;
  onCreated: (order: unknown) => void;
  onClose: () => void;
}

export function PurchaseFormModal({
  isOpen,
  suppliers,
  products,
  prefillItems,
  onCreated,
  onClose,
}: PurchaseFormModalProps) {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'BANK_TRANSFER' | 'MOBILE_BANKING' | 'CREDIT'>('CASH');
  const [discountStr, setDiscountStr] = useState('0');
  const [paidAmountStr, setPaidAmountStr] = useState('');
  const [notes, setNotes] = useState('');
  const [rows, setRows] = useState<LineRow[]>([
    { productId: '', quantity: '1', unitCost: '0', batchNumber: '', expiryDate: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen && prefillItems && prefillItems.length > 0) {
      setRows(
        prefillItems.map((item) => ({
          productId: item.productId,
          quantity: String(item.quantity),
          unitCost: String(item.unitCost),
          batchNumber: '',
          expiryDate: '',
        }))
      );
      setNotes('Auto-reorder from Inventory Analytics');
    }
  }, [isOpen, prefillItems]);

  if (!isOpen) return null;

  const subtotal = rows.reduce(
    (sum, r) => sum + Math.round((parseFloat(r.quantity) || 0) * (parseFloat(r.unitCost) || 0)),
    0
  );
  const discountAmount = Math.min(subtotal, Math.max(0, Math.round(parseFloat(discountStr) || 0)));
  const totalAmount = Math.max(0, subtotal - discountAmount);
  const effectivePaid =
    paymentMethod === 'CREDIT'
      ? Math.min(totalAmount, Math.max(0, parseFloat(paidAmountStr) || 0))
      : paidAmountStr.trim() === ''
        ? totalAmount
        : Math.min(totalAmount, Math.max(0, parseFloat(paidAmountStr) || 0));
  const dueAmount = Math.max(0, totalAmount - effectivePaid);

  function handleSelectProduct(idx: number, productId: string) {
    const product = products.find((p) => p.id === productId);
    setRows((prev) =>
      prev.map((row, i) =>
        i === idx
          ? {
              ...row,
              productId,
              unitCost: product ? String(product.costPrice) : row.unitCost,
            }
          : row
      )
    );
  }

  async function handleSubmit() {
    if (!supplierId) {
      addToast(t('Please select a supplier', 'ပေးသွင်းသူ ရွေးချယ်ပါ'), 'error');
      return;
    }
    const validItems = rows
      .filter((r) => r.productId && (parseFloat(r.quantity) || 0) > 0)
      .map((r) => ({
        productId: r.productId,
        quantity: parseFloat(r.quantity),
        unitCost: Math.max(0, parseFloat(r.unitCost) || 0),
        batchNumber: r.batchNumber.trim() || null,
        expiryDate: r.expiryDate || null,
      }));

    if (validItems.length === 0) {
      addToast(t('Add at least one product line', 'ကုန်ပစ္စည်း အနည်းဆုံး ၁ မျိုး ထည့်ပါ'), 'error');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          items: validItems,
          discountAmount,
          paidAmount: effectivePaid,
          paymentMethod,
          notes: notes.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to receive purchase order', 'ကုန်အဝယ် မှတ်တမ်းတင်မရပါ'), 'error');
        return;
      }
      addToast(
        t(
          'Purchase order received! Stock & Latest Cost updated.',
          'ကုန်အဝယ်စာရင်းသွင်းပြီးပါပြီ။ Stock နှင့် အရင်းဈေး အလိုအလျောက် update လုပ်ပြီးပါပြီ။'
        ),
        'success'
      );
      setRows([{ productId: '', quantity: '1', unitCost: '0', batchNumber: '', expiryDate: '' }]);
      setDiscountStr('0');
      setPaidAmountStr('');
      setNotes('');
      setPaymentMethod('CASH');
      onCreated(data);
      onClose();
    } catch {
      addToast(t('Network error', 'ကွန်ရက်ချို့ယွင်းချက်'), 'error');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 820 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <ShoppingBag size={18} strokeWidth={1.75} />
            {t('New Purchase Order / Receive Goods', 'ကုန်အဝယ်ဘောင်ချာ အသစ်သွင်းရန်')}
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">{t('Supplier *', 'ပေးသွင်းသူ *')}</label>
              <select
                className="input"
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
              >
                <option value="">{t('Select supplier', 'ပေးသွင်းသူ ရွေးပါ')}</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="input-group">
              <label className="input-label">{t('Payment Method', 'ငွေပေးချေမှုနည်းလမ်း')}</label>
              <select
                className="input"
                value={paymentMethod}
                onChange={(e) => {
                  const val = e.target.value as 'CASH' | 'BANK_TRANSFER' | 'MOBILE_BANKING' | 'CREDIT';
                  setPaymentMethod(val);
                  if (val === 'CREDIT') setPaidAmountStr('0');
                  else setPaidAmountStr('');
                }}
              >
                <option value="CASH">{t('Cash', 'ငွေသား')}</option>
                <option value="BANK_TRANSFER">{t('Bank Transfer', 'ဘဏ်လွှဲ')}</option>
                <option value="MOBILE_BANKING">{t('Mobile Banking', 'မိုဘိုင်းဘဏ်')}</option>
                <option value="CREDIT">{t('Credit (Payable Later)', 'အကြွေးဝယ်ယူမှု')}</option>
              </select>
            </div>
          </div>

          {/* Items Table */}
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="input-label" style={{ margin: 0 }}>
                {t('Purchased Items (Updates Stock + Latest Cost Price)', 'ဝယ်ယူသည့်ကုန်ပစ္စည်းများ (Stock နှင့် နောက်ဆုံးဝယ်ဈေး Update လုပ်မည်)')}
              </label>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() =>
                  setRows([...rows, { productId: '', quantity: '1', unitCost: '0', batchNumber: '', expiryDate: '' }])
                }
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Plus size={13} strokeWidth={2} />
                {t('Add Row', 'အတန်းထပ်တိုးရန်')}
              </button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rows.map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '2fr 80px 100px 100px 125px auto',
                    gap: 6,
                    alignItems: 'center',
                  }}
                >
                  <select
                    className="input"
                    value={row.productId}
                    onChange={(e) => handleSelectProduct(idx, e.target.value)}
                    style={{ fontSize: 12 }}
                  >
                    <option value="">{t('Select product...', 'ကုန်ပစ္စည်း ရွေးပါ...')}</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.sku} · {p.unit})
                      </option>
                    ))}
                  </select>
                  <input
                    type="number"
                    className="input"
                    min="0.001"
                    step="any"
                    placeholder={t('Qty', 'အရေအတွက်')}
                    value={row.quantity}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === idx ? { ...r, quantity: e.target.value } : r)))
                    }
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                  <input
                    type="number"
                    className="input"
                    min="0"
                    placeholder={t('Unit Cost', 'အရင်းဈေး')}
                    value={row.unitCost}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === idx ? { ...r, unitCost: e.target.value } : r)))
                    }
                    style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}
                  />
                  <input
                    type="text"
                    className="input"
                    placeholder={t('Batch #', 'အသုတ်နံပါတ်')}
                    value={row.batchNumber}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === idx ? { ...r, batchNumber: e.target.value } : r)))
                    }
                    style={{ fontSize: 12 }}
                  />
                  <input
                    type="date"
                    className="input"
                    value={row.expiryDate}
                    onChange={(e) =>
                      setRows(rows.map((r, i) => (i === idx ? { ...r, expiryDate: e.target.value } : r)))
                    }
                    style={{ fontSize: 11 }}
                  />
                  {rows.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      style={{ color: 'var(--danger)' }}
                      onClick={() => setRows(rows.filter((_, i) => i !== idx))}
                    >
                      <Trash2 size={14} strokeWidth={1.75} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-md)' }}>
            <div className="input-group">
              <label className="input-label">{t('Discount (K)', 'လျှော့ဈေး (ကျပ်)')}</label>
              <input
                type="number"
                className="input"
                min={0}
                value={discountStr}
                onChange={(e) => setDiscountStr(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="input-group">
              <label className="input-label">{t('Paid Upfront (K)', 'လက်ငင်းပေးငွေ (ကျပ်)')}</label>
              <input
                type="number"
                className="input"
                min={0}
                max={totalAmount}
                placeholder={String(totalAmount)}
                value={paidAmountStr}
                onChange={(e) => setPaidAmountStr(e.target.value)}
                style={{ fontFamily: 'var(--font-mono)' }}
              />
            </div>
            <div className="input-group">
              <label className="input-label">{t('notes')}</label>
              <input
                type="text"
                className="input"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder={t('Invoice / delivery ref', 'ဘောင်ချာနံပါတ် / မှတ်ချက်')}
              />
            </div>
          </div>

          <div
            style={{
              padding: 'var(--space-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: 12,
              fontSize: 'var(--text-sm)',
            }}
          >
            <span>{t('subtotal')}: <strong>{formatCurrency(subtotal)}</strong></span>
            <span>{t('Total', 'စုစုပေါင်း')}: <strong style={{ color: 'var(--primary)' }}>{formatCurrency(totalAmount)}</strong></span>
            <span>{t('Paid', 'ပေးပြီး')}: <strong style={{ color: 'var(--success)' }}>{formatCurrency(effectivePaid)}</strong></span>
            <span>{t('Payable Due', 'ကြွေးကျန်')}: <strong style={{ color: dueAmount > 0 ? 'var(--danger)' : undefined }}>{formatCurrency(dueAmount)}</strong></span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={handleSubmit} disabled={submitting}>
            {submitting
              ? t('Receiving...', 'စာရင်းသွင်းနေသည်...')
              : t('Receive Goods & Update Stock', 'ကုန်လက်ခံ၍ Stock သွင်းမည်')}
          </button>
        </div>
      </div>
    </div>
  );
}
