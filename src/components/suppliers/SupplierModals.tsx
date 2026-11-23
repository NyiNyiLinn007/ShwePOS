'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { X, CreditCard, Truck } from '@/components/ui/Icons';

export interface SupplierRecord {
  id: string;
  name: string;
  contactPerson: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  creditBalance: number;
  notes: string | null;
  isActive: boolean;
  createdAt: string | Date;
  purchaseOrderCount?: number;
  totalPurchased?: number;
  purchaseOrders?: Array<{
    id: string;
    poNumber: string;
    totalAmount: number;
    dueAmount: number;
    createdAt: string | Date;
  }>;
  payments?: Array<{
    id: string;
    amount: number;
    method: string;
    reference: string | null;
    notes: string | null;
    createdAt: string | Date;
    user?: { id: string; name: string };
  }>;
}

export interface SupplierFormInput {
  name: string;
  contactPerson: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
}

export const emptySupplierForm: SupplierFormInput = {
  name: '',
  contactPerson: '',
  phone: '',
  email: '',
  address: '',
  notes: '',
};

interface SupplierFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: SupplierFormInput;
  saving: boolean;
  onChange: (field: keyof SupplierFormInput, value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function SupplierFormModal({
  isOpen,
  isEditing,
  formData,
  saving,
  onChange,
  onSave,
  onClose,
}: SupplierFormModalProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Truck size={18} strokeWidth={1.75} />
            {isEditing
              ? t('Edit Supplier', 'ပေးသွင်းသူ ပြင်ဆင်ရန်')
              : t('Add Supplier', 'ပေးသွင်းသူအသစ် ထည့်ရန်')}
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-md)' }}>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label className="input-label">{t('Supplier Name *', 'ပေးသွင်းသူအမည် *')}</label>
            <input
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => onChange('name', e.target.value)}
              placeholder={t('Company or distributor name', 'ကုမ္ပဏီ သို့မဟုတ် ဖြန့်ချိသူအမည်')}
            />
          </div>
          <div className="input-group">
            <label className="input-label">{t('Contact Person', 'ဆက်သွယ်ရမည့်သူ')}</label>
            <input
              type="text"
              className="input"
              value={formData.contactPerson}
              onChange={(e) => onChange('contactPerson', e.target.value)}
              placeholder={t('Sales rep name', 'ကိုယ်စားလှယ်အမည်')}
            />
          </div>
          <div className="input-group">
            <label className="input-label">{t('phone')}</label>
            <input
              type="text"
              className="input"
              value={formData.phone}
              onChange={(e) => onChange('phone', e.target.value)}
              placeholder="+95 9xxxxxxxx"
            />
          </div>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label className="input-label">{t('Email', 'အီးမေးလ်')}</label>
            <input
              type="email"
              className="input"
              value={formData.email}
              onChange={(e) => onChange('email', e.target.value)}
              placeholder="supplier@example.com"
            />
          </div>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label className="input-label">{t('Address', 'လိပ်စာ')}</label>
            <input
              type="text"
              className="input"
              value={formData.address}
              onChange={(e) => onChange('address', e.target.value)}
              placeholder={t('Warehouse / office address', 'လိပ်စာ')}
            />
          </div>
          <div className="input-group" style={{ gridColumn: '1 / -1' }}>
            <label className="input-label">{t('notes')}</label>
            <textarea
              className="input"
              rows={2}
              value={formData.notes}
              onChange={(e) => onChange('notes', e.target.value)}
              placeholder={t('Payment terms, delivery days, etc.', 'ငွေပေးချေမှုစည်းကမ်း၊ ပို့ဆောင်ရက် စသည်')}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving ? t('Saving...', 'သိမ်းနေသည်...') : t('save')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SupplierRepayModalProps {
  supplier: SupplierRecord | null;
  amount: string;
  method: 'CASH' | 'BANK_TRANSFER' | 'MOBILE_BANKING';
  reference: string;
  notes: string;
  submitting: boolean;
  onChangeAmount: (v: string) => void;
  onChangeMethod: (v: 'CASH' | 'BANK_TRANSFER' | 'MOBILE_BANKING') => void;
  onChangeReference: (v: string) => void;
  onChangeNotes: (v: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function SupplierRepayModal({
  supplier,
  amount,
  method,
  reference,
  notes,
  submitting,
  onChangeAmount,
  onChangeMethod,
  onChangeReference,
  onChangeNotes,
  onSubmit,
  onClose,
}: SupplierRepayModalProps) {
  const { t } = useI18n();
  if (!supplier) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} strokeWidth={1.75} />
            {t('Pay Supplier Payable', 'ပေးသွင်းသူ အကြွေးပေးချေရန်')}
          </h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div
            style={{
              padding: 'var(--space-md)',
              background: 'var(--bg-secondary)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
            }}
          >
            <div style={{ fontWeight: 700 }}>{supplier.name}</div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--danger)', marginTop: 4 }}>
              {t('Outstanding Payable', 'ပေးရန်ကျန်ငွေ')}:{' '}
              <strong>{formatCurrency(supplier.creditBalance)}</strong>
            </div>
          </div>

          <div className="input-group">
            <label className="input-label">{t('Payment Amount (K) *', 'ပေးချေမည့်ပမာဏ (ကျပ်) *')}</label>
            <input
              type="number"
              className="input"
              min={1}
              max={supplier.creditBalance}
              value={amount}
              onChange={(e) => onChangeAmount(e.target.value)}
              style={{ fontFamily: 'var(--font-mono)' }}
            />
          </div>

          <div className="input-group">
            <label className="input-label">{t('Payment Method', 'ငွေပေးချေမှုနည်းလမ်း')}</label>
            <select
              className="input"
              value={method}
              onChange={(e) =>
                onChangeMethod(e.target.value as 'CASH' | 'BANK_TRANSFER' | 'MOBILE_BANKING')
              }
            >
              <option value="CASH">{t('Cash', 'ငွေသား')}</option>
              <option value="BANK_TRANSFER">{t('Bank Transfer', 'ဘဏ်လွှဲ')}</option>
              <option value="MOBILE_BANKING">{t('Mobile Banking', 'မိုဘိုင်းဘဏ်')}</option>
            </select>
          </div>

          {method !== 'CASH' && (
            <div className="input-group">
              <label className="input-label">{t('Reference / Slip No. *', 'လွှဲနံပါတ် *')}</label>
              <input
                type="text"
                className="input"
                value={reference}
                onChange={(e) => onChangeReference(e.target.value)}
                placeholder={t('Transaction ID', 'ငွေလွှဲနံပါတ်')}
              />
            </div>
          )}

          <div className="input-group">
            <label className="input-label">{t('notes')}</label>
            <input
              type="text"
              className="input"
              value={notes}
              onChange={(e) => onChangeNotes(e.target.value)}
              placeholder={t('Optional notes', 'မှတ်ချက် (ရှိပါက)')}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>
            {t('cancel')}
          </button>
          <button type="button" className="btn btn-primary" onClick={onSubmit} disabled={submitting}>
            {submitting
              ? t('Processing...', 'ဆောင်ရွက်နေသည်...')
              : t('Record Payment', 'ငွေပေးချေမှု မှတ်တမ်းတင်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface SupplierDetailModalProps {
  supplier: SupplierRecord | null;
  onClose: () => void;
  onPay: (supplier: SupplierRecord) => void;
}

export function SupplierDetailModal({
  supplier,
  onClose,
  onPay,
}: SupplierDetailModalProps) {
  const { t } = useI18n();
  if (!supplier) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640 }}>
        <div className="modal-header">
          <h2 className="modal-title">{supplier.name}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-sm)', fontSize: 'var(--text-sm)' }}>
            <div><strong>{t('Contact', 'ဆက်သွယ်သူ')}:</strong> {supplier.contactPerson || '—'}</div>
            <div><strong>{t('phone')}:</strong> {supplier.phone || '—'}</div>
            <div><strong>{t('Email', 'အီးမေးလ်')}:</strong> {supplier.email || '—'}</div>
            <div>
              <strong>{t('Payable Balance', 'ပေးရန်ကျန်ငွေ')}:</strong>{' '}
              <span style={{ color: supplier.creditBalance > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 700 }}>
                {formatCurrency(supplier.creditBalance)}
              </span>
            </div>
          </div>

          <div>
            <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 6 }}>
              {t('Recent Purchase Orders', 'နောက်ဆုံး ကုန်အဝယ်ဘောင်ချာများ')}
            </h4>
            {!supplier.purchaseOrders || supplier.purchaseOrders.length === 0 ? (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {t('No purchase orders yet', 'ကုန်အဝယ်မှတ်တမ်း မရှိသေးပါ')}
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>PO #</th>
                      <th>{t('date')}</th>
                      <th style={{ textAlign: 'right' }}>{t('total')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Due', 'ကျန်ငွေ')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.purchaseOrders.map((po) => (
                      <tr key={po.id}>
                        <td><code>{po.poNumber}</code></td>
                        <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(po.createdAt)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{formatCurrency(po.totalAmount)}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: po.dueAmount > 0 ? 'var(--danger)' : undefined }}>
                          {formatCurrency(po.dueAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {supplier.payments && supplier.payments.length > 0 && (
            <div>
              <h4 style={{ fontSize: 'var(--text-sm)', fontWeight: 700, marginBottom: 6 }}>
                {t('Recent Payments to Supplier', 'ပေးသွင်းသူသို့ ငွေပေးချေမှုမှတ်တမ်း')}
              </h4>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('date')}</th>
                      <th>{t('Method', 'နည်းလမ်း')}</th>
                      <th>{t('Ref', 'လွှဲနံပါတ်')}</th>
                      <th style={{ textAlign: 'right' }}>{t('amount')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {supplier.payments.map((p) => (
                      <tr key={p.id}>
                        <td style={{ fontSize: 'var(--text-xs)' }}>{formatDateTime(p.createdAt)}</td>
                        <td>{p.method}</td>
                        <td>{p.reference || '—'}</td>
                        <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: 'var(--success)', fontWeight: 600 }}>
                          {formatCurrency(p.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {supplier.creditBalance > 0 && (
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onPay(supplier);
              }}
            >
              {t('Pay Supplier Debt', 'အကြွေးပေးချေရန်')}
            </button>
          )}
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('close')}
          </button>
        </div>
      </div>
    </div>
  );
}
