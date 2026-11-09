'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDateTime, formatQuantity, isFractionalUnit } from '@/lib/utils';
import { PAYMENT_METHODS, SALE_STATUSES } from '@/lib/constants';
import {
  PaymentMethodIcon,
  Package,
  RotateCcw,
  Ban,
  Calendar,
  User,
  UserCog,
  FileSpreadsheet,
  CreditCard,
  Printer,
  X,
} from '@/components/ui/Icons';
import Receipt from '@/components/pos/Receipt';

const paymentMethodTranslationKeys: Record<string, string> = {
  CASH: 'cash',
  CARD: 'card',
  MOBILE_BANKING: 'mobileBanking',
  CREDIT: 'credit',
  SPLIT: 'splitPayment',
};

const saleStatusTranslationKeys: Record<string, string> = {
  COMPLETED: 'completed',
  PARTIALLY_REFUNDED: 'partiallyRefunded',
  REFUNDED: 'refunded',
  VOIDED: 'voided',
};

/* ---------- Types ---------- */

interface SaleProduct {
  id?: string;
  name: string;
  nameMm: string | null;
  sku: string;
  barcode?: string | null;
  unit?: string;
}

interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  refundedQuantity?: number;
  unitPrice: number;
  costPrice?: number;
  discount: number;
  total: number;
  product?: SaleProduct;
}

interface SalePaymentItem {
  id: string;
  method: string;
  amount: number;
  reference?: string | null;
}

interface SaleCustomer {
  id: string;
  name: string;
  phone: string | null;
  email?: string | null;
}

interface SaleUser {
  id: string;
  name: string;
}

interface Sale {
  id: string;
  invoiceNumber: string;
  customerId: string | null;
  userId: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paidAmount: number;
  changeAmount: number;
  dueAmount?: number;
  pointsEarned?: number;
  pointsRedeemed?: number;
  paymentMethod: string;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  customer?: SaleCustomer | null;
  user?: SaleUser;
  items?: SaleItem[];
  payments?: SalePaymentItem[];
}

/* ---------- Component ---------- */

export function SaleDetailClient({
  sale: initialSale,
  userRole = 'CASHIER',
}: {
  sale: Sale;
  userRole?: string;
}) {
  const { language, t } = useI18n();
  const { addToast } = useToast();
  const [sale, setSale] = useState<Sale>(initialSale);

  // Refund / Void modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [actionType, setActionType] = useState<'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED'>('REFUNDED');
  const [refundMethod, setRefundMethod] = useState<'ORIGINAL' | 'CASH'>('ORIGINAL');
  const [reason, setReason] = useState('');
  const [refundQuantities, setRefundQuantities] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);

  const canManageRefund = userRole === 'ADMIN' || userRole === 'MANAGER';

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'badge-success';
      case 'PARTIALLY_REFUNDED': return 'badge-warning';
      case 'REFUNDED': return 'badge-warning';
      case 'VOIDED': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  function getStatusLabel(status: string): string {
    if (status === 'PARTIALLY_REFUNDED') {
      return t('Partially Refunded', 'တစ်စိတ်တစ်ပိုင်း ပြန်အမ်းပြီး');
    }
    return SALE_STATUSES.some((s) => s.value === status)
      ? t(saleStatusTranslationKeys[status] ?? status)
      : status;
  }

  function getPaymentLabel(method: string): string {
    if (method === 'SPLIT') {
      return t('Split Payment', 'ပေါင်းစပ်ငွေပေးချေမှု');
    }
    const found = PAYMENT_METHODS.find((p) => p.value === method);
    return found ? t(paymentMethodTranslationKeys[method] ?? method) : method;
  }

  function openActionModal(type: 'VOIDED' | 'REFUNDED' | 'PARTIALLY_REFUNDED') {
    setActionType(type);
    setRefundMethod('ORIGINAL');
    setReason('');
    const initialMap: Record<string, string> = {};
    sale.items?.forEach((item) => {
      initialMap[item.id] = '0';
    });
    setRefundQuantities(initialMap);
    setModalOpen(true);
  }

  async function handleSubmitAction() {
    if (!reason.trim()) {
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
        addToast(t('Please enter quantity for at least one item to refund', 'ပြန်အမ်းမည့် ပစ္စည်းအရေအတွက် အနည်းဆုံး ၁ ခု ထည့်ပါ'), 'error');
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
          reason: reason.trim(),
          refundMethod,
          items: itemsPayload,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        addToast(data.error || t('Failed to update sale', 'အရောင်းအခြေအနေပြောင်းမရပါ'), 'error');
        return;
      }
      setSale(data);
      setModalOpen(false);
      addToast(
        actionType === 'VOIDED'
          ? t('Sale voided successfully', 'အရောင်းပယ်ဖျက်ပြီးပါပြီ')
          : t('Sale refunded successfully', 'အရောင်းပြန်အမ်းပြီးပါပြီ'),
        'success'
      );
    } catch {
      addToast(t('Network error. Please try again.', 'ကွန်ရက်ချို့ယွင်းချက်။ ထပ်ကြိုးစားပါ။'), 'error');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="page-body">
      {/* Action Buttons (Print Receipt + Manager/Admin Refund/Void) */}
      <div
        className="flex gap-sm no-print"
        style={{ justifyContent: 'flex-end', marginBottom: 'var(--space-md)', flexWrap: 'wrap' }}
      >
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowReceipt(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
        >
          <Printer size={14} strokeWidth={1.75} />
          {t('Print Receipt', 'ဘောင်ချာ ပရင့်ထုတ်ရန်')}
        </button>
        {canManageRefund && (sale.status === 'COMPLETED' || sale.status === 'PARTIALLY_REFUNDED') && (
          <>
            <button
              className="btn btn-warning btn-sm"
              onClick={() => openActionModal('PARTIALLY_REFUNDED')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Package size={14} strokeWidth={1.75} />
              {t('Partial Refund', 'ပစ္စည်းအချို့ ပြန်အမ်းရန်')}
            </button>
            <button
              className="btn btn-warning btn-sm"
              onClick={() => openActionModal('REFUNDED')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <RotateCcw size={14} strokeWidth={1.75} />
              {t('Full Refund', 'ဘောင်ချာအပြည့် ပြန်အမ်းရန်')}
            </button>
            {sale.status === 'COMPLETED' && (
              <button
                className="btn btn-danger btn-sm"
                onClick={() => openActionModal('VOIDED')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
              >
                <Ban size={14} strokeWidth={1.75} />
                {t('Void Sale', 'အရောင်းပယ်ဖျက်ရန်')}
              </button>
            )}
          </>
        )}
      </div>

      {/* Info Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 'var(--space-md)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <InfoCard
          label={t('Date & Time', 'ရက်စွဲနှင့်အချိန်')}
          value={formatDateTime(sale.createdAt)}
          icon={<Calendar size={14} strokeWidth={1.75} />}
        />
        <InfoCard
          label={t('customer')}
          value={sale.customer?.name || t('walkIn')}
          sub={sale.customer?.phone || undefined}
          icon={<User size={14} strokeWidth={1.75} />}
        />
        <InfoCard
          label={t('cashier')}
          value={sale.user?.name || '—'}
          icon={<UserCog size={14} strokeWidth={1.75} />}
        />
        <InfoCard
          label={t('Status', 'အခြေအနေ')}
          badge={
            <span className={`badge ${getStatusBadgeClass(sale.status)}`}>
              {getStatusLabel(sale.status)}
            </span>
          }
          icon={<FileSpreadsheet size={14} strokeWidth={1.75} />}
        />
        <InfoCard
          label={t('payment')}
          value={getPaymentLabel(sale.paymentMethod)}
          icon={<PaymentMethodIcon method={sale.paymentMethod} size={14} />}
        />
      </div>

      {/* Items Table */}
      <div
        style={{
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          overflow: 'hidden',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <div
          style={{
            padding: 'var(--space-md) var(--space-lg)',
            borderBottom: '1px solid var(--border-color)',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}
        >
          {t('items')} ({sale.items?.length || 0})
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                <th style={{ textAlign: 'center' }}>{t('Qty', 'အရေအတွက်')}</th>
                <th style={{ textAlign: 'right' }}>{t('Unit Price', 'တစ်ခုဈေး')}</th>
                <th style={{ textAlign: 'right' }}>{t('discount')}</th>
                <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, idx) => {
                const refunded = Number(item.refundedQuantity || 0);
                return (
                  <tr key={item.id}>
                    <td style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
                      {idx + 1}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                        {language === 'mm' && item.product?.nameMm
                          ? item.product.nameMm
                          : item.product?.name || 'Unknown Product'}
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
                    <td
                      style={{
                        textAlign: 'center',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                      }}
                    >
                      <div>{formatQuantity(item.quantity, item.product?.unit)}</div>
                      {refunded > 0 && (
                        <div style={{ fontSize: '11px', color: 'var(--warning)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                          <RotateCcw size={11} strokeWidth={1.75} />
                          {t('Refunded', 'ပြန်အမ်းပြီး')}: {formatQuantity(refunded, item.product?.unit)}
                        </div>
                      )}
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
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment Summary */}
      <div
        style={{
          maxWidth: 420,
          marginLeft: 'auto',
          padding: 'var(--space-lg)',
          background: 'var(--bg-secondary)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border-color)',
          marginBottom: 'var(--space-xl)',
        }}
      >
        <SummaryRow
          label={t('subtotal')}
          value={formatCurrency(sale.subtotal)}
        />
        {sale.discountAmount > 0 && (
          <SummaryRow
            label={t('discount')}
            value={`-${formatCurrency(sale.discountAmount)}`}
            danger
          />
        )}
        {sale.taxAmount > 0 && (
          <SummaryRow
            label={t('Tax', 'အခွန်')}
            value={formatCurrency(sale.taxAmount)}
          />
        )}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            paddingTop: 'var(--space-sm)',
            marginTop: 'var(--space-sm)',
            borderTop: '2px solid var(--border-color)',
            fontWeight: 700,
            fontSize: 'var(--text-lg)',
          }}
        >
          <span>{t('Total', 'စုစုပေါင်း')}</span>
          <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--primary)' }}>
            {formatCurrency(sale.totalAmount)}
          </span>
        </div>

        {/* Split Payments Breakdown */}
        {sale.payments && sale.payments.length > 0 && (
          <div
            style={{
              marginTop: 'var(--space-sm)',
              paddingTop: 'var(--space-sm)',
              borderTop: '1px dashed var(--border-color)',
            }}
          >
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600, color: 'var(--text-muted)', marginBottom: 4 }}>
              {t('Payment Breakdown', 'ငွေပေးချေမှု အသေးစိတ်')}
            </div>
            {sale.payments.map((p) => (
              <SummaryRow
                key={p.id}
                label={`${getPaymentLabel(p.method)}${p.reference ? ` (${p.reference})` : ''}`}
                value={formatCurrency(p.amount)}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--space-md)' }}>
          <SummaryRow
            label={t('Paid', 'ပေးငွေ')}
            value={formatCurrency(sale.paidAmount)}
          />
          {sale.changeAmount > 0 && (
            <SummaryRow
              label={t('Change', 'ပြန်အမ်းငွေ')}
              value={formatCurrency(sale.changeAmount)}
            />
          )}
          {(sale.dueAmount ?? 0) > 0 && (
            <SummaryRow
              label={t('Due (Credit)', 'ကြွေးကျန်')}
              value={formatCurrency(sale.dueAmount ?? 0)}
              danger
            />
          )}
          {((sale.pointsEarned ?? 0) > 0 || (sale.pointsRedeemed ?? 0) > 0) && (
            <div style={{ marginTop: 'var(--space-xs)', paddingTop: 'var(--space-xs)', borderTop: '1px dashed var(--border-color)' }}>
              {(sale.pointsRedeemed ?? 0) > 0 && (
                <SummaryRow
                  label={t('Points Redeemed', 'သုံးခဲ့သည့်ပွိုင့်')}
                  value={`-${sale.pointsRedeemed} pts`}
                />
              )}
              {(sale.pointsEarned ?? 0) > 0 && (
                <SummaryRow
                  label={t('Points Earned', 'ရရှိသည့်ပွိုင့်')}
                  value={`+${sale.pointsEarned} pts`}
                />
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notes */}
      {sale.notes && (
        <div
          style={{
            padding: 'var(--space-md) var(--space-lg)',
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-color)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong style={{ color: 'var(--text-primary)' }}>
            {t('notes')}:
          </strong>
          <div style={{ marginTop: 'var(--space-xs)' }}>{sale.notes}</div>
        </div>
      )}

      {/* Refund / Void Modal */}
      {modalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
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
                  : t('Full Refund Sale', 'ဘောင်ချာအပြည့် ပြန်အမ်းရန်')}
              </h2>
              <button className="btn btn-ghost btn-icon" onClick={() => setModalOpen(false)}>
                <X size={16} strokeWidth={1.75} />
              </button>
            </div>
            <div className="modal-body">
              {actionType === 'PARTIALLY_REFUNDED' && (
                <div style={{ marginBottom: 'var(--space-md)' }}>
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>
                    {t('Enter the quantity to refund for each item:', 'ပြန်အမ်းလိုသည့် ပစ္စည်းအရေအတွက်ကို ထည့်သွင်းပါ -')}
                  </div>
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                          <th style={{ textAlign: 'center' }}>{t('Remaining Qty', 'ကျန်ရှိအရေအတွက်')}</th>
                          <th style={{ textAlign: 'right' }}>{t('Refund Qty', 'ပြန်အမ်းမည့်အရေအတွက်')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {sale.items?.map((item) => {
                          const remaining = Math.max(0, Number(item.quantity) - Number(item.refundedQuantity || 0));
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
                                  style={{ width: 100, textAlign: 'right', marginLeft: 'auto' }}
                                />
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="input-group" style={{ marginBottom: 'var(--space-md)' }}>
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
                    {t('Refund as Cash (Deduct from Cash Drawer)', 'ငွေသားဖြင့် ပြန်အမ်းမည် (အံဆွဲမှနှုတ်မည်)')}
                  </option>
                </select>
              </div>

              <div className="input-group">
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
              <button
                className="btn btn-secondary"
                onClick={() => setModalOpen(false)}
                disabled={processing}
              >
                {t('Cancel', 'မလုပ်တော့ပါ')}
              </button>
              <button
                className="btn btn-danger"
                onClick={handleSubmitAction}
                disabled={processing || !reason.trim()}
              >
                {processing
                  ? t('Processing...', 'ဆောင်ရွက်နေသည်...')
                  : t('Confirm', 'အတည်ပြုရန်')}
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && (
        <Receipt
          data={{
            invoiceNumber: sale.invoiceNumber,
            createdAt: typeof sale.createdAt === 'string' ? sale.createdAt : sale.createdAt.toISOString(),
            cashierName: sale.user?.name || '—',
            customerName: sale.customer?.name || null,
            items: (sale.items || []).map((item) => ({
              name: language === 'mm' && item.product?.nameMm ? item.product.nameMm : item.product?.name || 'Item',
              quantity: Number(item.quantity),
              unitPrice: Number(item.unitPrice),
              discount: Number(item.discount || 0),
              total: Number(item.total),
              unit: item.product?.unit,
            })),
            subtotal: Number(sale.subtotal),
            discountAmount: Number(sale.discountAmount),
            taxAmount: Number(sale.taxAmount),
            totalAmount: Number(sale.totalAmount),
            paymentMethod: sale.paymentMethod,
            paidAmount: Number(sale.paidAmount),
            dueAmount: Number(sale.dueAmount || 0),
            changeAmount: Number(sale.changeAmount),
            pointsEarned: Number(sale.pointsEarned || 0),
            pointsRedeemed: Number(sale.pointsRedeemed || 0),
            payments: (sale.payments || []).map((p) => ({
              method: p.method,
              amount: Number(p.amount),
              reference: p.reference,
            })),
          }}
          onNewSale={() => setShowReceipt(false)}
          closeLabel={t('Close', 'ပိတ်ရန်')}
        />
      )}
    </div>
  );
}

/* ---------- Sub-Components ---------- */

function InfoCard({
  label,
  value,
  sub,
  icon,
  badge,
}: {
  label: string;
  value?: string;
  sub?: string;
  icon: React.ReactNode;
  badge?: React.ReactNode;
}) {
  return (
    <div
      style={{
        padding: 'var(--space-md) var(--space-lg)',
        background: 'var(--bg-secondary)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-xs)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-muted)',
          marginBottom: 'var(--space-xs)',
        }}
      >
        <span>{icon}</span>
        {label}
      </div>
      {badge || (
        <>
          <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>{value}</div>
          {sub && (
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
              {sub}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  danger,
}: {
  label: string;
  value: string;
  danger?: boolean;
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        marginBottom: 'var(--space-xs)',
        fontSize: 'var(--text-sm)',
      }}
    >
      <span style={{ color: danger ? 'var(--danger)' : 'var(--text-muted)' }}>
        {label}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-mono)',
          color: danger ? 'var(--danger)' : undefined,
        }}
      >
        {value}
      </span>
    </div>
  );
}
