'use client';

import React, { useState, useEffect } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatQuantity, isFractionalUnit } from '@/lib/utils';
import { SaleRecord } from '@/lib/saleHelpers';
import { X } from '@/components/ui/Icons';

export type SaleRefundAction = 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED';

interface SaleRefundModalProps {
  sale: SaleRecord | null;
  actionType: SaleRefundAction;
  onClose: () => void;
  onSuccess: (updatedSale: SaleRecord) => void;
}

export function SaleRefundModal({
  sale,
  actionType,
  onClose,
  onSuccess,
}: SaleRefundModalProps) {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [refundMethod, setRefundMethod] = useState<'ORIGINAL' | 'CASH'>('ORIGINAL');
  const [reason, setReason] = useState('');
  const [refundQuantities, setRefundQuantities] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (sale) {
      setRefundMethod('ORIGINAL');
      setReason('');
      const initialMap: Record<string, string> = {};
      sale.items?.forEach((item) => {
        initialMap[item.id] = '0';
      });
      setRefundQuantities(initialMap);
    }
  }, [sale, actionType]);

  if (!sale) return null;

  async function handleSubmit() {
    if (!sale) return;
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
      addToast(t('reasonRequired'), 'error');
      return;
    }

    let itemsPayload: { saleItemId: string; quantity: number }[] | undefined;
    if (actionType === 'PARTIALLY_REFUNDED') {
      itemsPayload = Object.entries(refundQuantities)
        .map(([saleItemId, qtyStr]) => ({
          saleItemId,
          quantity: parseFloat(qtyStr) || 0,
        }))
        .filter((i) => i.quantity > 0);

      if (itemsPayload.length === 0) {
        addToast(
          t(
            'Please enter quantity for at least one item to refund',
            'ပြန်အမ်းမည့် ပစ္စည်းအရေအတွက် အနည်းဆုံး ၁ ခု ထည့်ပါ'
          ),
          'error'
        );
        return;
      }
    }

    setProcessing(true);
    try {
      const res = await fetch(`/api/sales/${sale.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: actionType,
          reason: trimmedReason,
          refundMethod,
          items: itemsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(
          data.error || t('Failed to update sale', 'အရောင်းအခြေအနေပြောင်းမရပါ'),
          'error'
        );
        return;
      }

      addToast(
        actionType === 'VOIDED'
          ? t('Sale voided successfully', 'အရောင်းပယ်ဖျက်ပြီးပါပြီ')
          : t('Sale refunded successfully', 'အရောင်းပြန်အမ်းပြီးပါပြီ'),
        'success'
      );
      onSuccess(data);
    } catch {
      addToast(
        t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'),
        'error'
      );
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: actionType === 'PARTIALLY_REFUNDED' ? 620 : 480 }}
      >
        <div className="modal-header">
          <h2 className="modal-title">
            {actionType === 'VOIDED'
              ? t('Void Sale', 'အရောင်းပယ်ဖျက်ရန်')
              : actionType === 'PARTIALLY_REFUNDED'
                ? t('Partial Item Refund', 'ပစ္စည်းအချို့သာ ပြန်အမ်းရန်')
                : t('Refund Sale', 'အရောင်းပြန်အမ်းရန်')}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body">
          {actionType === 'PARTIALLY_REFUNDED' ? (
            <div style={{ marginBottom: 'var(--space-md)' }}>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
                {t(
                  'Enter the quantity to refund for each item:',
                  'ပြန်အမ်းလိုသည့် ပစ္စည်းအရေအတွက်ကို ထည့်သွင်းပါ -'
                )}
              </div>
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                      <th style={{ textAlign: 'center' }}>{t('Remaining', 'ကျန်ရှိ')}</th>
                      <th style={{ textAlign: 'right' }}>{t('Refund Qty', 'ပြန်အမ်းမည့်အရေအတွက်')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sale.items?.map((item) => {
                      const remaining = Math.max(
                        0,
                        Number(item.quantity) - Number(item.refundedQuantity || 0)
                      );
                      const fractional = isFractionalUnit(item.product?.unit);
                      return (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                              {item.product?.name || 'Item'}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                              {formatCurrency(item.unitPrice)} / {item.product?.unit || 'pcs'}
                            </div>
                          </td>
                          <td style={{ textAlign: 'center', fontFamily: 'var(--font-mono)' }}>
                            {formatQuantity(remaining, item.product?.unit)}
                          </td>
                          <td style={{ textAlign: 'right' }}>
                            <input
                              type="number"
                              className="input"
                              disabled={remaining <= 0}
                              min="0"
                              max={remaining}
                              step={fractional ? '0.01' : '1'}
                              value={refundQuantities[item.id] ?? '0'}
                              onChange={(e) =>
                                setRefundQuantities((prev) => ({
                                  ...prev,
                                  [item.id]: e.target.value,
                                }))
                              }
                              style={{ width: 96, textAlign: 'right', marginLeft: 'auto' }}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <p
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                lineHeight: 1.6,
              }}
            >
              {t('Are you sure you want to', 'သေချာပါသလား')}{' '}
              {actionType === 'VOIDED' ? t('void', 'ပယ်ဖျက်') : t('refund', 'ပြန်အမ်း')}{' '}
              {t('sale', 'အရောင်း')}{' '}
              <strong style={{ color: 'var(--text-primary)' }}>{sale.invoiceNumber}</strong> for{' '}
              <strong style={{ color: 'var(--primary)' }}>
                {formatCurrency(sale.totalAmount)}
              </strong>
              ?
            </p>
          )}

          <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
            <label className="input-label">
              {t('Refund Method', 'ပြန်အမ်းမည့် ငွေပေးချေမှုနည်းလမ်း')}
            </label>
            <select
              className="input"
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value as 'ORIGINAL' | 'CASH')}
            >
              <option value="ORIGINAL">
                {t('Original Payment Method', 'မူလငွေပေးချေမှုနည်းလမ်းအတိုင်း')} ({sale.paymentMethod})
              </option>
              <option value="CASH">
                {t(
                  'Refund as Cash (Deduct from Cash Drawer)',
                  'ငွေသားဖြင့် ပြန်အမ်းမည် (အံဆွဲမှနှုတ်မည်)'
                )}
              </option>
            </select>
          </div>

          <div className="input-group" style={{ marginTop: 'var(--space-md)' }}>
            <label className="input-label">{t('reasonLabel')} *</label>
            <textarea
              className="input"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t('enterReason')}
              rows={3}
              maxLength={500}
            />
          </div>
        </div>
        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose} disabled={processing}>
            {t('Cancel', 'မလုပ်တော့ပါ')}
          </button>
          <button
            className="btn btn-danger"
            onClick={handleSubmit}
            disabled={processing || !reason.trim()}
          >
            {processing
              ? t('Processing...', 'ဆောင်ရွက်နေသည်...')
              : actionType === 'VOIDED'
                ? t('Void Sale', 'အရောင်းပယ်ဖျက်ရန်')
                : t('Refund Sale', 'အရောင်းပြန်အမ်းရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
