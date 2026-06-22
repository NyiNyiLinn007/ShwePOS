'use client';

import Link from 'next/link';
import { useAppStore } from '@/lib/store';
import { formatCurrency, formatTime } from '@/lib/utils';

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
};

const paymentMethodLabel: Record<string, { en: string; mm: string }> = {
  CASH: { en: 'Cash', mm: 'လက်ငွေ' },
  CARD: { en: 'Card', mm: 'ကတ်' },
  MOBILE_BANKING: { en: 'Mobile', mm: 'မိုဘိုင်း' },
  CREDIT: { en: 'Credit', mm: 'အကြွေး' },
};

export default function RecentSales({ sales }: RecentSalesProps) {
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: 'var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <h3 className="heading-4">
          {t('Recent Sales', 'မကြာမီက ရောင်းချမှုများ')}
        </h3>
      </div>

      {sales.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-2xl)' }}>
          <div className="empty-state-icon">🛒</div>
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
        <div className="table-container" style={{ border: 'none' }}>
          <table className="table">
            <thead>
              <tr>
                <th>{t('Invoice #', 'ပြေစာ #')}</th>
                <th>{t('Customer', 'ဝယ်သူ')}</th>
                <th style={{ textAlign: 'center' }}>{t('Items', 'အမျိုးအစား')}</th>
                <th style={{ textAlign: 'right' }}>{t('Total', 'စုစုပေါင်း')}</th>
                <th>{t('Payment', 'ငွေပေးချေမှု')}</th>
                <th style={{ textAlign: 'right' }}>{t('Time', 'အချိန်')}</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => {
                const methodInfo = paymentMethodLabel[sale.paymentMethod] ?? {
                  en: sale.paymentMethod,
                  mm: sale.paymentMethod,
                };
                const badgeClass =
                  paymentMethodBadge[sale.paymentMethod] ?? 'badge-neutral';

                return (
                  <tr key={sale.id}>
                    <td>
                      <Link
                        href={`/sales/${sale.id}`}
                        style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}
                      >
                        {sale.invoiceNumber}
                      </Link>
                    </td>
                    <td style={{ color: 'var(--text-secondary)' }}>
                      {sale.customerName ?? t('Walk-in', 'ဝင်ဝယ်သူ')}
                    </td>
                    <td style={{ textAlign: 'center' }}>{sale.itemCount}</td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 700,
                        color: 'var(--primary)',
                      }}
                    >
                      {formatCurrency(sale.totalAmount)}
                    </td>
                    <td>
                      <span className={`badge ${badgeClass}`}>
                        {t(methodInfo.en, methodInfo.mm)}
                      </span>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        color: 'var(--text-muted)',
                        fontSize: 'var(--text-sm)',
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
