'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatDateTime, formatQuantity } from '@/lib/utils';
import {
  SaleRecord,
  buildReceiptDataFromSale,
  getPaymentMethodLabel,
  getSaleStatusBadgeClass,
  getSaleStatusLabel,
} from '@/lib/saleHelpers';
import {
  PaymentMethodIcon,
  Package,
  RotateCcw,
  Ban,
  Calendar,
  User,
  UserCog,
  FileSpreadsheet,
  Printer,
} from '@/components/ui/Icons';
import Receipt from '@/components/pos/Receipt';
import { SaleRefundModal, SaleRefundAction } from '@/components/sales/SaleRefundModal';

export function SaleDetailClient({
  sale: initialSale,
  userRole = 'CASHIER',
}: {
  sale: SaleRecord;
  userRole?: string;
}) {
  const { language, t } = useI18n();
  const [sale, setSale] = useState<SaleRecord>(initialSale);

  const [modalOpen, setModalOpen] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [actionType, setActionType] = useState<SaleRefundAction>('REFUNDED');

  const canManageRefund = userRole === 'ADMIN' || userRole === 'MANAGER';

  function openActionModal(type: SaleRefundAction) {
    setActionType(type);
    setModalOpen(true);
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
        {canManageRefund &&
          (sale.status === 'COMPLETED' || sale.status === 'PARTIALLY_REFUNDED') && (
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
            <span className={`badge ${getSaleStatusBadgeClass(sale.status)}`}>
              {getSaleStatusLabel(sale.status, t)}
            </span>
          }
          icon={<FileSpreadsheet size={14} strokeWidth={1.75} />}
        />
        <InfoCard
          label={t('payment')}
          value={getPaymentMethodLabel(sale.paymentMethod, t)}
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
                        <div
                          style={{
                            fontSize: '11px',
                            color: 'var(--warning)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <RotateCcw size={11} strokeWidth={1.75} />
                          {t('Refunded', 'ပြန်အမ်းပြီး')}:{' '}
                          {formatQuantity(refunded, item.product?.unit)}
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
        <SummaryRow label={t('subtotal')} value={formatCurrency(sale.subtotal)} />
        {sale.discountAmount > 0 && (
          <SummaryRow
            label={t('discount')}
            value={`-${formatCurrency(sale.discountAmount)}`}
            danger
          />
        )}
        {sale.taxAmount > 0 && (
          <SummaryRow label={t('Tax', 'အခွန်')} value={formatCurrency(sale.taxAmount)} />
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
            <div
              style={{
                fontSize: 'var(--text-xs)',
                fontWeight: 600,
                color: 'var(--text-muted)',
                marginBottom: 4,
              }}
            >
              {t('Payment Breakdown', 'ငွေပေးချေမှု အသေးစိတ်')}
            </div>
            {sale.payments.map((p) => (
              <SummaryRow
                key={p.id}
                label={`${getPaymentMethodLabel(p.method, t)}${p.reference ? ` (${p.reference})` : ''}`}
                value={formatCurrency(p.amount)}
              />
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--space-md)' }}>
          <SummaryRow label={t('Paid', 'ပေးငွေ')} value={formatCurrency(sale.paidAmount)} />
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
            <div
              style={{
                marginTop: 'var(--space-xs)',
                paddingTop: 'var(--space-xs)',
                borderTop: '1px dashed var(--border-color)',
              }}
            >
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
          <strong style={{ color: 'var(--text-primary)' }}>{t('notes')}:</strong>
          <div style={{ marginTop: 'var(--space-xs)' }}>{sale.notes}</div>
        </div>
      )}

      <SaleRefundModal
        sale={modalOpen ? sale : null}
        actionType={actionType}
        onClose={() => setModalOpen(false)}
        onSuccess={(updatedSale) => {
          setSale(updatedSale);
          setModalOpen(false);
        }}
      />

      {showReceipt && (
        <Receipt
          data={buildReceiptDataFromSale(sale, language)}
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
