'use client';

import Link from 'next/link';
import { useI18n } from '@/lib/i18n';
import { formatDate, formatQuantity } from '@/lib/utils';
import StatCards from '@/components/dashboard/StatCards';
import RecentSales from '@/components/dashboard/RecentSales';
import TopProducts from '@/components/dashboard/TopProducts';
import SalesChart from '@/components/charts/SalesChart';
import { AlertTriangle, Clock, CheckCircle2 } from '@/components/ui/Icons';

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

interface AlertProductItem {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  stockQuantity: number;
  lowStockThreshold: number;
  unit: string;
  expiryDate: string | null;
  batchNumber: string | null;
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
  alertProducts?: AlertProductItem[];
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
  alertProducts = [],
}: DashboardClientProps) {
  const { language, t } = useI18n();

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

        {/* Top Products & Inventory/Expiry Alerts Row */}
        <div className="grid-2">
          <TopProducts products={topProducts} />

          <div className="glass-card" style={{ padding: 'var(--space-xl)', display: 'flex', flexDirection: 'column' }}>
            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-md)' }}>
              <div>
                <h2 className="heading-4" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={16} strokeWidth={1.75} style={{ color: 'var(--warning)' }} />
                  {t('Stock & Expiry Alerts', 'လက်ကျန်နည်း နှင့် သက်တမ်းကုန်ခါနီး သတိပေးချက်')}
                </h2>
                <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                  {t('Items needing restock or expiring within 30 days', 'ထပ်ဖြည့်ရန်လိုသော သို့မဟုတ် ရက် ၃၀ အတွင်း သက်တမ်းကုန်မည့် ပစ္စည်းများ')}
                </p>
              </div>
              <Link href="/inventory" className="btn btn-secondary btn-sm">
                {t('Manage', 'စီမံရန်')}
              </Link>
            </div>

            {alertProducts.length === 0 ? (
              <div className="empty-state" style={{ flex: 1, minHeight: 200 }}>
                <div className="empty-state-icon" style={{ color: 'var(--success)' }}>
                  <CheckCircle2 size={24} strokeWidth={1.75} />
                </div>
                <div className="empty-state-title">
                  {t('All stock levels healthy', 'ကုန်ပစ္စည်းလက်ကျန် အားလုံး ကောင်းမွန်ပါသည်')}
                </div>
                <div className="empty-state-text">
                  {t('No low-stock or expiring items detected.', 'လက်ကျန်နည်းနေသော သို့မဟုတ် သက်တမ်းကုန်ခါနီး ပစ္စည်း မရှိပါ။')}
                </div>
              </div>
            ) : (
              <div className="table-container" style={{ maxHeight: 320, overflowY: 'auto' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                      <th style={{ textAlign: 'right' }}>{t('stock')}</th>
                      <th>{t('Status', 'အခြေအနေ')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alertProducts.map((item) => {
                      const isLow = item.stockQuantity <= item.lowStockThreshold;
                      const expDate = item.expiryDate ? new Date(item.expiryDate) : null;
                      const daysLeft = expDate
                        ? Math.ceil((expDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
                        : null;
                      return (
                        <tr key={item.id}>
                          <td>
                            <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)' }}>
                              {language === 'mm' && item.nameMm ? item.nameMm : item.name}
                            </div>
                            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                              {item.sku}{item.batchNumber ? ` · Batch: ${item.batchNumber}` : ''}
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 600 }}>
                            {formatQuantity(item.stockQuantity, item.unit)}
                          </td>
                          <td>
                            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                              {isLow && (
                                <span className={`badge ${item.stockQuantity <= 0 ? 'badge-danger' : 'badge-warning'}`}>
                                  {item.stockQuantity <= 0 ? t('Out of Stock', 'ပစ္စည်းပြတ်') : t('Low Stock', 'လက်ကျန်နည်း')}
                                </span>
                              )}
                              {daysLeft !== null && daysLeft <= 30 && (
                                <span
                                  className={`badge ${daysLeft < 0 ? 'badge-danger' : 'badge-warning'}`}
                                  style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                                >
                                  <Clock size={10} strokeWidth={2} />
                                  {daysLeft < 0
                                    ? t('Expired', 'သက်တမ်းကုန်')
                                    : `${daysLeft}d (${formatDate(expDate!)})`}
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
