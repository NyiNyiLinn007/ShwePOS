'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatTime } from '@/lib/utils';
import { Receipt } from '@/components/ui/Icons';

interface RecentSaleItem {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  itemCount: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

interface RecentSalesProps {
  sales: RecentSaleItem[];
}

const paymentMethodBadge: Record<string, string> = {
  CASH: 'badge-success',
  CARD: 'badge-info',
  MOBILE_BANKING: 'badge-primary',
  CREDIT: 'badge-warning',
  SPLIT: 'badge-neutral',
};

const paymentMethodTranslationKeys: Record<string, string> = {
  CASH: 'cash',
  CARD: 'card',
  MOBILE_BANKING: 'mobileBanking',
  CREDIT: 'credit',
  SPLIT: 'splitPayment',
};

export default function RecentSales({ sales }: RecentSalesProps) {
  const { t } = useI18n();

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
          {t('Recent Sales', 'မကြာမီက ရောင်းချမှုများ')}
        </h3>
        <Link href="/sales" style={{ fontSize: 'var(--text-xs)', fontWeight: 500 }}>
          {t('View all', 'အားလုံးကြည့်ရန်')} →
        </Link>
      </div>

      {sales.length === 0 ? (
        <div className="empty-state" style={{ border: 'none', borderRadius: 0 }}>
          <div className="empty-state-icon">
            <Receipt size={20} strokeWidth={1.75} />
          </div>
          <div className="empty-state-title">
            {t('No sales today', 'ယနေ့ ရောင်းချမှုမရှိပါ')}
          </div>
          <div className="empty-state-text">
            {t(
              'Sales will appear here once transactions are made.',
              'ရောင်းချမှုများပြုလုပ်ပြီးသည်နှင့် ဤနေရာတွင် ပေါ်လာမည်ဖြစ်ပါသည်။'
            )}
          </div>
        </div>
      ) : (
        <div className="table-container" style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('invoiceNumber')}</th>
                <th>{t('customer')}</th>
                <th style={{ textAlign: 'center' }}>{t('items')}</th>
                <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                <th>{t('payment')}</th>
                <th style={{ textAlign: 'right' }}>{t('time')}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const badgeClass =
                  paymentMethodBadge[sale.paymentMethod] ?? 'badge-neutral';

                return (
                  <tr key={sale.id}>
                    <td>
                      <Link
                        href={`/sales/${sale.id}`}
                        style={{
                          fontWeight: 600,
                          fontSize: 'var(--text-xs)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {sale.invoiceNumber}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {sale.customerName ?? t('walkIn')}
                    </td>
                    <td style={{ textAlign: 'center' }}>{sale.itemCount}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                      }}
                    >
                      {formatCurrency(sale.totalAmount)}
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        {t(paymentMethodTranslationKeys[sale.paymentMethod] ?? sale.paymentMethod)}
                      </span>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--text-xs)',
                      }}
                    >
                      {formatTime(sale.createdAt)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
