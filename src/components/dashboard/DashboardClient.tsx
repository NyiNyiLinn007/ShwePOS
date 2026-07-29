'use client';

import { useAppStore } from '@/lib/store';
import StatCards from '@/components/dashboard/StatCards';
import RecentSales from '@/components/dashboard/RecentSales';
import TopProducts from '@/components/dashboard/TopProducts';
import SalesChart from '@/components/charts/SalesChart';

interface RecentSaleItem {
  id: string;
  invoiceNumber: string;
  customerName: string | null;
  itemCount: number;
  totalAmount: number;
  paymentMethod: string;
  createdAt: string;
}

interface TopProductItem {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface SalesDataPoint {
  date: string;
  amount: number;
}

interface DashboardClientProps {
  role: string;
  todayRevenue: number;
  totalSales: number;
  totalProducts: number;
  lowStockCount: number;
  recentSales: RecentSaleItem[];
  topProducts: TopProductItem[];
  salesChartData: SalesDataPoint[];
}

export default function DashboardClient({
  role,
  todayRevenue,
  totalSales,
  totalProducts,
  lowStockCount,
  recentSales,
  topProducts,
  salesChartData,
}: DashboardClientProps) {
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  return (
    <div className="animate-fade-in">
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Dashboard', 'ဒက်ရှ်ဘုတ်')}</h1>
          <p className="page-subtitle">
            {t(
              'Overview of your business performance',
              'သင့်လုပ်ငန်းစွမ်းဆောင်ရည် ခြုံငုံသုံးသပ်ချက်'
            )}
          </p>
        </div>
        <span className="badge badge-primary dashboard-role-badge">
          {role === 'CASHIER' ? 'Cashier workspace' : `${role.toLowerCase()} overview`}
        </span>
      </div>

      {/* Page Body */}
      <div className="page-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xl)' }}>
        {/* Stat Cards */}
        <StatCards
          todayRevenue={todayRevenue}
          totalSales={totalSales}
          totalProducts={totalProducts}
          lowStockCount={lowStockCount}
        />

        {/* Charts & Recent Sales Row */}
        <div className="grid-2">
          <SalesChart data={salesChartData} />
          <RecentSales sales={recentSales} />
        </div>

        {/* Top Products */}
        <TopProducts products={topProducts} />
      </div>
    </div>
  );
}
