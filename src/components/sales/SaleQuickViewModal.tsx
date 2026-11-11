'use client';

import React from 'react';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import {
  SaleRecord,
  getPaymentMethodLabel,
  getSaleStatusBadgeClass,
  getSaleStatusLabel,
} from '@/lib/saleHelpers';
import { SaleRefundAction } from '@/components/sales/SaleRefundModal';
import { Printer, X, Ban, Package, RotateCcw } from '@/components/ui/Icons';

interface SaleQuickViewModalProps {
  sale: SaleRecord | null;
  onClose: () => void;
  onPrint: (sale: SaleRecord) => void;
  onRequestAction: (sale: SaleRecord, action: SaleRefundAction) => void;
}

export function SaleQuickViewModal({
  sale,
  onClose,
  onPrint,
  onRequestAction,
}: SaleQuickViewModalProps) {
  const { t } = useI18n();

  if (!sale) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">
            {t('Sale Details', 'အရောင်းအသေးစိတ်')} — {sale.invoiceNumber}
          </h2>
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
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Date & Time', 'ရက်စွဲနှင့်အချိန်')}
              </div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                {formatDateTime(sale.createdAt)}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('customer')}
              </div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                {sale.customer?.name || t('walkIn')}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('cashier')}
              </div>
              <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                {sale.user?.name || '—'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 2 }}>
                {t('Status', 'အခြေအနေ')}
              </div>
              <span className={`badge ${getSaleStatusBadgeClass(sale.status)}`}>
                {getSaleStatusLabel(sale.status, t)}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <h3
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                marginBottom: 'var(--space-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              {t('items')}
            </h3>
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                    <th style={{ textAlign: 'center' }}>{t('Qty', 'အရေအတွက်')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Unit Price', 'တစ်ခုဈေး')}</th>
                    <th style={{ textAlign: 'right' }}>{t('discount')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                  </tr>
                </thead>
                <tbody>
                  {sale.items?.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                          {item.product?.name || 'Unknown Product'}
                        </div>
                        {item.product?.sku && (
                          <div
                            style={{
                              fontSize: 'var(--text-xs)',
                              color: 'var(--text-muted)',
                              fontFamily: 'var(--font-mono)',
                            }}
                          >
                            {item.product.sku}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                        {item.quantity}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        {formatCurrency(item.unitPrice)}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        {item.discount > 0 ? (
                          <span style={{ color: 'var(--danger)' }}>
                            -{formatCurrency(item.discount)}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontWeight: 600,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 'var(--text-sm)',
                        }}
                      >
                        {formatCurrency(item.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div
            style={{
              padding: 'var(--space-md)',
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginBottom: 'var(--space-xs)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>{t('subtotal')}</span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {formatCurrency(sale.subtotal)}
              </span>
            </div>
            {sale.discountAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-xs)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span style={{ color: 'var(--danger)' }}>{t('discount')}</span>
                <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--danger)' }}>
                  -{formatCurrency(sale.discountAmount)}
                </span>
              </div>
            )}
            {sale.taxAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  marginBottom: 'var(--space-xs)',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>{t('Tax', 'အခွန်')}</span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(sale.taxAmount)}
                </span>
              </div>
            )}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: 'var(--space-sm)',
                borderTop: '1px solid var(--border-color)',
                fontWeight: 700,
                fontSize: 'var(--text-base)',
              }}
            >
              <span>{t('Total', 'စုစုပေါင်း')}</span>
              <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
                {formatCurrency(sale.totalAmount)}
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: 'var(--space-sm)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span style={{ color: 'var(--text-muted)' }}>
                {t('payment')}: {getPaymentMethodLabel(sale.paymentMethod, t)}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)' }}>
                {t('Paid', 'ပေးငွေ')}: {formatCurrency(sale.paidAmount)}
              </span>
            </div>
            {sale.changeAmount > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--text-sm)',
                }}
              >
                <span style={{ color: 'var(--text-muted)' }}>
                  {t('Change', 'ပြန်အမ်းငွေ')}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatCurrency(sale.changeAmount)}
                </span>
              </div>
            )}
          </div>

          {sale.notes && (
            <div
              style={{
                marginTop: 'var(--space-md)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              <strong>{t('notes')}:</strong> {sale.notes}
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button
            className="btn btn-secondary"
            onClick={() => onPrint(sale)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginRight: 'auto' }}
          >
            <Printer size={15} strokeWidth={1.75} />
            {t('Print Receipt', 'ဘောင်ချာ ပရင့်ထုတ်ရန်')}
          </button>
          {(sale.status === 'COMPLETED' || sale.status === 'PARTIALLY_REFUNDED') && (
            <>
              {sale.status === 'COMPLETED' && (
                <button
                  className="btn btn-danger"
                  onClick={() => onRequestAction(sale, 'VOIDED')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                >
                  <Ban size={15} strokeWidth={1.75} />
                  {t('Void Sale', 'အရောင်းပယ်ဖျက်ရန်')}
                </button>
              )}
              <button
                className="btn btn-warning"
                onClick={() => onRequestAction(sale, 'PARTIALLY_REFUNDED')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Package size={15} strokeWidth={1.75} />
                {t('Partial Refund', 'ပစ္စည်းအချို့ ပြန်အမ်းရန်')}
              </button>
              <button
                className="btn btn-warning"
                onClick={() => onRequestAction(sale, 'REFUNDED')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <RotateCcw size={15} strokeWidth={1.75} />
                {t('Refund', 'ပြန်အမ်းရန်')}
              </button>
            </>
          )}
          <button className="btn btn-secondary" onClick={onClose}>
            {t('Close', 'ပိတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
