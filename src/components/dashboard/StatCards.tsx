'use client';

import { useI18n } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
import {
  Banknote,
  ShoppingCart,
  Package,
  AlertTriangle,
  CheckCircle2,
} from '@/components/ui/Icons';

interface StatCardsProps {
  todayRevenue: number;
  totalSales: number;
  totalProducts: number;
  lowStockCount: number;
}

export default function StatCards({
  todayRevenue,
  totalSales,
  totalProducts,
  lowStockCount,
}: StatCardsProps) {
  const { t } = useI18n();
  const avgSale = totalSales > 0 ? Math.round(todayRevenue / totalSales) : 0;

  const stats = [
    {
      icon: <Banknote size={18} strokeWidth={1.75} />,
      label: t("Today's Revenue", 'ယနေ့ဝင်ငွေ'),
      value: formatCurrency(todayRevenue),
      meta: `${t('Avg Order', 'ပျမ်းမျှ')}: ${formatCurrency(avgSale)}`,
      color: 'gold',
    },
    {
      icon: <ShoppingCart size={18} strokeWidth={1.75} />,
      label: t('totalSales'),
      value: String(totalSales),
      meta: t("Today's completed transactions", 'ယနေ့ ပြီးမြောက်သည့်အရောင်း'),
      color: 'green',
    },
    {
      icon: <Package size={18} strokeWidth={1.75} />,
      label: t('Total Products', 'စုစုပေါင်းပစ္စည်း'),
      value: String(totalProducts),
      meta: t('Active catalog items', 'လက်ရှိ ရောင်းချနေသောပစ္စည်း'),
      color: 'blue',
    },
    {
      icon: lowStockCount > 0 ? <AlertTriangle size={18} strokeWidth={1.75} /> : <CheckCircle2 size={18} strokeWidth={1.75} />,
      label: t('lowStockItems'),
      value: String(lowStockCount),
      meta: lowStockCount > 0 ? `${lowStockCount} ${t('units')}` : t('allGood'),
      color: lowStockCount > 0 ? 'red' : 'green',
    },
  ];

  return (
    <div className="grid-stats">
      {stats.map((stat) => (
        <div key={stat.label} className={`stat-card stat-card-${stat.color}`}>
          <div className="stat-card-header">
            <div className="stat-card-label">{stat.label}</div>
            <div className="stat-card-icon">{stat.icon}</div>
          </div>
          <div className="stat-card-value">{stat.value}</div>
          <div className="stat-card-meta">{stat.meta}</div>
        </div>
      ))}
    </div>
  );
}
