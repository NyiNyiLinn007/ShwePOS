'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { getSaleStatusBadgeClass } from '@/lib/saleHelpers';
import { Star, CreditCard, Pencil, X, AlertTriangle } from '@/components/ui/Icons';

export interface CustomerRecentSale {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  status: string;
  createdAt: string | Date;
}

export interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  totalPurchases: number;
  creditBalance?: number;
  creditLimit?: number | null;
  loyaltyPoints: number;
  createdAt: string | Date;
  updatedAt: string | Date;
  purchaseCount: number;
  lastPurchaseDate: string | Date | null;
  recentSales: CustomerRecentSale[];
}

export interface CustomerFormInput {
  name: string;
  phone: string;
  email: string;
  address: string;
  creditLimit: string;
}

export const emptyCustomerForm: CustomerFormInput = {
  name: '',
  phone: '',
  email: '',
  address: '',
  creditLimit: '0',
};

interface CustomerFormModalProps {
  isOpen: boolean;
  isEditing: boolean;
  formData: CustomerFormInput;
  formErrors: Record<string, string>;
  saving: boolean;
  onChange: (field: keyof CustomerFormInput, value: string) => void;
  onSave: () => void;
  onClose: () => void;
}

export function CustomerFormModal({
  isOpen,
  isEditing,
  formData,
  formErrors,
  saving,
  onChange,
  onSave,
  onClose,
}: CustomerFormModalProps) {
  const { t } = useI18n();
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 520 }}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            {isEditing
              ? t('Edit Customer', 'ဖောက်သည်ပြင်ဆင်ရန်')
              : t('Add Customer', 'ဖောက်သည်ထည့်ရန်')}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body">
          <div className="input-group">
            <label className="input-label">{t('Name *', 'အမည် *')}</label>
            <input
              type="text"
              className={`input ${formErrors.name ? 'input-error' : ''}`}
              placeholder={t('Customer name', 'ဖောက်သည်အမည်')}
              value={formData.name}
              onChange={(e) => onChange('name', e.target.value)}
            />
            {formErrors.name && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                {formErrors.name}
              </span>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">{t('phone')}</label>
            <input
              type="tel"
              className="input"
              placeholder="e.g. 09-123456789"
              value={formData.phone}
              onChange={(e) => onChange('phone', e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">{t('Email', 'အီးမေးလ်')}</label>
            <input
              type="email"
              className={`input ${formErrors.email ? 'input-error' : ''}`}
              placeholder="customer@email.com"
              value={formData.email}
              onChange={(e) => onChange('email', e.target.value)}
            />
            {formErrors.email && (
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--danger)' }}>
                {formErrors.email}
              </span>
            )}
          </div>

          <div className="input-group">
            <label className="input-label">{t('Address', 'လိပ်စာ')}</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Customer address"
              value={formData.address}
              onChange={(e) => onChange('address', e.target.value)}
              style={{ resize: 'vertical' }}
            />
          </div>

          <div className="input-group">
            <label className="input-label">
              {t(
                'Credit Limit (MMK) — 0 = Unlimited',
                'အကြွေးကန့်သတ်ချက် (ကျပ်) — 0 = အကန့်အသတ်မရှိ'
              )}
            </label>
            <input
              type="number"
              min="0"
              step="1000"
              className="input"
              value={formData.creditLimit}
              onChange={(e) => onChange('creditLimit', e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={saving}>
            {t('Cancel', 'မလုပ်တော့ပါ')}
          </button>
          <button className="btn btn-primary" onClick={onSave} disabled={saving}>
            {saving
              ? t('Saving...', 'သိမ်းနေသည်...')
              : isEditing
                ? t('Update Customer', 'ဖောက်သည်အချက်အလက်ပြင်ရန်')
                : t('Create Customer', 'ဖောက်သည်ဖန်တီးရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CustomerDetailModalProps {
  customer: CustomerData | null;
  onClose: () => void;
  onEdit: (customer: CustomerData) => void;
  onRepayDebt: (customer: CustomerData) => void;
}

export function CustomerDetailModal({
  customer,
  onClose,
  onEdit,
  onRepayDebt,
}: CustomerDetailModalProps) {
  const { t } = useI18n();
  if (!customer) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">{t('Customer Details', 'ဖောက်သည်အသေးစိတ်')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body">
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: 'var(--space-md)',
              marginBottom: 'var(--space-lg)',
              padding: 'var(--space-lg)',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-lg)',
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Name', 'အမည်')}
              </div>
              <div style={{ fontWeight: 700, fontSize: 'var(--text-lg)' }}>
                {customer.name}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('phone')}
              </div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                {customer.phone || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Email', 'အီးမေးလ်')}
              </div>
              <div style={{ fontSize: 'var(--text-sm)' }}>{customer.email || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Address', 'လိပ်စာ')}
              </div>
              <div style={{ fontSize: 'var(--text-sm)' }}>{customer.address || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Total Purchases', 'စုစုပေါင်းဝယ်ယူမှု')}
              </div>
              <div style={{ fontWeight: 700, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(customer.totalPurchases)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Loyalty Points', 'အမှတ်စု')}
              </div>
              <div style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <Star size={14} strokeWidth={1.75} />
                {customer.loyaltyPoints}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Credit Due (Debt)', 'ကြွေးကျန်')}
              </div>
              <div
                style={{
                  fontWeight: 700,
                  color: (customer.creditBalance ?? 0) > 0 ? 'var(--danger)' : 'var(--success)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {formatCurrency(customer.creditBalance ?? 0)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Credit Limit', 'အကြွေးကန့်သတ်ချက်')}
              </div>
              <div style={{ fontSize: 'var(--text-sm)', fontFamily: 'var(--font-mono)' }}>
                {(customer.creditLimit ?? 0) > 0
                  ? formatCurrency(customer.creditLimit ?? 0)
                  : t('Unlimited', 'အကန့်အသတ်မရှိ')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Customer Since', 'ဖောက်သည်ဖြစ်သည့်ရက်')}
              </div>
              <div style={{ fontSize: 'var(--text-sm)' }}>
                {formatDate(customer.createdAt)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('totalOrders')}
              </div>
              <div style={{ fontWeight: 600 }}>{customer.purchaseCount}</div>
            </div>
          </div>

          <h3
            style={{
              fontSize: 'var(--text-sm)',
              fontWeight: 700,
              marginBottom: 'var(--space-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            {t('Recent Purchase History', 'လတ်တလောဝယ်ယူမှုမှတ်တမ်း')}
          </h3>
          {customer.recentSales.length === 0 ? (
            <div
              style={{
                padding: 'var(--space-xl)',
                textAlign: 'center',
                color: 'var(--text-muted)',
                fontSize: 'var(--text-sm)',
              }}
            >
              {t('No purchases yet', 'ဝယ်ယူမှုမှတ်တမ်းမရှိသေးပါ')}
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Invoice', 'ပြေစာ')}</th>
                    <th>{t('Date', 'ရက်စွဲ')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Amount', 'ပမာဏ')}</th>
                    <th>{t('Status', 'အခြေအနေ')}</th>
                  </tr>
                </thead>
                <tbody>
                  {customer.recentSales.map((sale) => (
                    <tr key={sale.id}>
                      <td>
                        <code
                          style={{
                            fontSize: 'var(--text-xs)',
                            fontFamily: 'var(--font-mono)',
                            background: 'var(--bg-tertiary)',
                            padding: '2px 6px',
                            borderRadius: 'var(--radius-sm)',
                          }}
                        >
                          {sale.invoiceNumber}
                        </code>
                      </td>
                      <td style={{ fontSize: 'var(--text-sm)' }}>
                        {formatDateTime(sale.createdAt)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--primary)',
                        }}
                      >
                        {formatCurrency(sale.totalAmount)}
                      </td>
                      <td>
                        <span className={`badge ${getSaleStatusBadgeClass(sale.status)}`}>
                          {sale.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="modal-footer">
          {(customer.creditBalance ?? 0) > 0 && (
            <button
              className="btn btn-warning"
              onClick={() => onRepayDebt(customer)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <CreditCard size={15} strokeWidth={1.75} />
              {t('Repay Debt', 'အကြွေးဆပ်ရန်')}
            </button>
          )}
          <button
            className="btn btn-secondary"
            onClick={() => {
              onClose();
              onEdit(customer);
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Pencil size={15} strokeWidth={1.75} />
            {t('Edit', 'ပြင်ဆင်ရန်')}
          </button>
          <button className="btn btn-secondary" onClick={onClose}>
            {t('Close', 'ပိတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CustomerRepayModalProps {
  customer: CustomerData | null;
  repayAmount: string;
  repayMethod: 'CASH' | 'CARD' | 'MOBILE_BANKING';
  repayReference: string;
  repayNotes: string;
  repaying: boolean;
  onChangeAmount: (val: string) => void;
  onChangeMethod: (val: 'CASH' | 'CARD' | 'MOBILE_BANKING') => void;
  onChangeReference: (val: string) => void;
  onChangeNotes: (val: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function CustomerRepayModal({
  customer,
  repayAmount,
  repayMethod,
  repayReference,
  repayNotes,
  repaying,
  onChangeAmount,
  onChangeMethod,
  onChangeReference,
  onChangeNotes,
  onSubmit,
  onClose,
}: CustomerRepayModalProps) {
  const { t } = useI18n();
  if (!customer) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={18} strokeWidth={1.75} />
            {t('Repay Debt', 'အကြွေးဆပ်ရန်')} — {customer.name}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body">
          <div
            style={{
              padding: 'var(--space-md)',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              marginBottom: 'var(--space-md)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
              {t('Current Credit Due', 'လက်ရှိကြွေးကျန်')}:
            </span>
            <strong
              style={{
                fontSize: 'var(--text-lg)',
                color: 'var(--danger)',
                fontFamily: 'var(--font-mono)',
              }}
            >
              {formatCurrency(customer.creditBalance ?? 0)}
            </strong>
          </div>

          <div className="input-group">
            <label className="input-label">
              {t('Repayment Amount (MMK)', 'ပေးဆပ်မည့်ပမာဏ (ကျပ်)')} *
            </label>
            <input
              type="number"
              min="1"
              max={customer.creditBalance ?? 0}
              className="input"
              value={repayAmount}
              onChange={(e) => onChangeAmount(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">
              {t('Payment Method', 'ငွေပေးချေမှုနည်းလမ်း')}
            </label>
            <select
              className="input"
              value={repayMethod}
              onChange={(e) =>
                onChangeMethod(e.target.value as 'CASH' | 'CARD' | 'MOBILE_BANKING')
              }
            >
              <option value="CASH">{t('cash')}</option>
              <option value="MOBILE_BANKING">{t('mobileBanking')}</option>
              <option value="CARD">{t('card')}</option>
            </select>
          </div>

          <div className="input-group">
            <label className="input-label">
              {t('Reference (Optional)', 'ရည်ညွှန်းနံပါတ် (ရှိလျှင်)')}
            </label>
            <input
              type="text"
              className="input"
              placeholder="KBZPay / Wave Tx ID"
              value={repayReference}
              onChange={(e) => onChangeReference(e.target.value)}
            />
          </div>

          <div className="input-group">
            <label className="input-label">{t('notes')}</label>
            <input
              type="text"
              className="input"
              value={repayNotes}
              onChange={(e) => onChangeNotes(e.target.value)}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={repaying}>
            {t('Cancel', 'မလုပ်တော့ပါ')}
          </button>
          <button className="btn btn-primary" onClick={onSubmit} disabled={repaying}>
            {repaying
              ? t('Saving...', 'သိမ်းနေသည်...')
              : t('Confirm Repayment', 'အကြွေးဆပ်မှု အတည်ပြုရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}

interface CustomerDeleteModalProps {
  customer: CustomerData | null;
  deleting: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function CustomerDeleteModal({
  customer,
  deleting,
  onConfirm,
  onClose,
}: CustomerDeleteModalProps) {
  const { t } = useI18n();
  if (!customer) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 440 }}
      >
        <div className="modal-header">
          <h2 className="modal-title">{t('Delete Customer', 'ဖောက်သည်ဖျက်ရန်')}</h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body">
          <p
            style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              lineHeight: 1.6,
            }}
          >
            {t('Are you sure you want to delete', 'ဖျက်လိုသည်မှာ သေချာပါသလား')}{' '}
            <strong style={{ color: 'var(--text-primary)' }}>{customer.name}</strong>?
          </p>
          {customer.purchaseCount > 0 ? (
            <div
              style={{
                marginTop: 'var(--space-md)',
                padding: 'var(--space-md)',
                background: 'var(--warning-light)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--warning)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>
                {t(
                  `This customer has ${customer.purchaseCount} purchase${customer.purchaseCount !== 1 ? 's' : ''}. Customers with purchase history cannot be deleted.`,
                  `ဤဖောက်သည်တွင် ဝယ်ယူမှု ${customer.purchaseCount} ခုရှိပါသည်။ ဝယ်ယူမှုမှတ်တမ်းရှိသောဖောက်သည်ကို ဖျက်ပယ်မရပါ။`
                )}
              </span>
            </div>
          ) : (
            <div
              style={{
                marginTop: 'var(--space-md)',
                padding: 'var(--space-md)',
                background: 'var(--danger-light)',
                borderRadius: 'var(--radius-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--danger)',
                display: 'flex',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              <AlertTriangle size={16} strokeWidth={1.75} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>{t('This action cannot be undone.', 'ဤလုပ်ဆောင်ချက်ကို ပြန်ဖျက်မရပါ။')}</span>
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={deleting}>
            {t('Cancel', 'မလုပ်တော့ပါ')}
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={deleting || customer.purchaseCount > 0}
          >
            {deleting ? t('Deleting...', 'ဖျက်နေသည်...') : t('Delete', 'ဖျက်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
