'use client';

import React from 'react';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { PAYMENT_METHODS, SALE_STATUSES } from '@/lib/constants';

/* ---------- Types ---------- */

interface SaleProduct {
  id?: string;
  name: string;
  nameMm: string | null;
  sku: string;
  barcode?: string | null;
}

interface SaleItem {
  id: string;
  productId: string;
  quantity: number;
  unitPrice: number;
  costPrice?: number;
  discount: number;
  total: number;
  product?: SaleProduct;
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
  paymentMethod: string;
  status: string;
  notes: string | null;
  createdAt: string | Date;
  customer?: SaleCustomer | null;
  user?: SaleUser;
  items?: SaleItem[];
}

/* ---------- Component ---------- */

export function SaleDetailClient({ sale }: { sale: Sale }) {
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  function getStatusBadgeClass(status: string): string {
    switch (status) {
      case 'COMPLETED': return 'badge-success';
      case 'REFUNDED': return 'badge-warning';
      case 'VOIDED': return 'badge-danger';
      default: return 'badge-neutral';
    }
  }

  function getStatusLabel(status: string): string {
    const found = SALE_STATUSES.find((s) => s.value === status);
    return found ? found.label : status;
  }

  function getPaymentLabel(method: string): string {
    const found = PAYMENT_METHODS.find((p) => p.value === method);
    return found ? `${found.icon} ${found.label}` : method;
  }

  return (
    <div className="page-body">
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
          icon="📅"
        />
        <InfoCard
          label={t('Customer', 'ဖောက်သည်')}
          value={sale.customer?.name || t('Walk-in Customer', 'ဝင်လာဖောက်သည်')}
          sub={sale.customer?.phone || undefined}
          icon="👤"
        />
        <InfoCard
          label={t('Cashier', 'ကောင်တာဝန်ထမ်း')}
          value={sale.user?.name || '—'}
          icon="🧑‍💼"
        />
        <InfoCard
          label={t('Status', 'အခြေအနေ')}
          badge={
            <span className={`badge ${getStatusBadgeClass(sale.status)}`}>
              {getStatusLabel(sale.status)}
            </span>
          }
          icon="📋"
        />
        <InfoCard
          label={t('Payment', 'ငွေပေးချေမှု')}
          value={getPaymentLabel(sale.paymentMethod)}
          icon="💳"
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
          {t('Items', 'ပစ္စည်းများ')} ({sale.items?.length || 0})
        </div>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                <th style={{ textAlign: 'center' }}>{t('Qty', 'အရေအတွက်')}</th>
                <th style={{ textAlign: 'right' }}>{t('Unit Price', 'တစ်ခုဈေး')}</th>
                <th style={{ textAlign: 'right' }}>{t('Discount', 'လျှော့စျေး')}</th>
                <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
              </tr>
            </thead>
            <tbody>
              {sale.items?.map((item, idx) => (
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
          label={t('Subtotal', 'စုစုပေါင်း(မလျှော့မီ)')}
          value={formatCurrency(sale.subtotal)}
        />
        {sale.discountAmount > 0 && (
          <SummaryRow
            label={t('Discount', 'လျှော့စျေး')}
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
            {t('Notes', 'မှတ်စု')}:
          </strong>
          <div style={{ marginTop: 'var(--space-xs)' }}>{sale.notes}</div>
        </div>
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
  icon: string;
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
