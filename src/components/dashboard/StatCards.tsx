'use client';

import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

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
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  const stats = [
    {
      icon: '💰',
      label: t("Today's Revenue", 'ယနေ့ဝင်ငွေ'),
      value: formatCurrency(todayRevenue),
      change: '+12.5%',
      changeDir: 'up' as const,
      color: 'gold',
    },
    {
      icon: '🛍️',
      label: t('Total Sales', 'စုစုပေါင်းရောင်းအား'),
      value: String(totalSales),
      change: '+8.2%',
      changeDir: 'up' as const,
      color: 'green',
    },
    {
      icon: '📦',
      label: t('Total Products', 'စုစုပေါင်းပစ္စည်း'),
      value: String(totalProducts),
      change: '+3.1%',
      changeDir: 'up' as const,
      color: 'blue',
    },
    {
      icon: '⚠️',
      label: t('Low Stock Items', 'စတော့နည်းပစ္စည်း'),
      value: String(lowStockCount),
      change: lowStockCount > 0 ? `${lowStockCount} ${t('items', 'ခု')}` : t('All good', 'ကောင်းပါသည်'),
      changeDir: lowStockCount > 0 ? ('down' as const) : ('up' as const),
      color: 'red',
    },
  ];

  return (
    <div className="grid-stats">
      {stats.map((stat) => (
        <div key={stat.label} className={`stat-card stat-card-${stat.color}`}>
          <div className="stat-card-icon">
            <span>{stat.icon}</span>
          </div>
          <div className="stat-card-value">{stat.value}</div>
          <div className="stat-card-label">{stat.label}</div>
          <div className={`stat-card-change ${stat.changeDir}`}>
            {stat.changeDir === 'up' ? '↑' : '↓'} {stat.change}
          </div>
        </div>
      ))}
    </div>
  );
}
