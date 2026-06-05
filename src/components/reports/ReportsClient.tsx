'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts';
import { useAppStore } from '@/lib/store';
import { formatCurrency } from '@/lib/utils';

/* ---------- Types ---------- */

interface ReportSummary {
  totalRevenue: number;
  totalProfit: number;
  totalCost: number;
  totalSalesCount: number;
  averageSaleValue: number;
}

interface DailySale {
  date: string;
  revenue: number;
  count: number;
  profit: number;
}

interface PaymentBreakdown {
  method: string;
  count: number;
  amount: number;
}

interface TopProduct {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  qtySold: number;
  revenue: number;
  cost: number;
  profit: number;
  profitMargin: number;
}

interface CategoryBreakdown {
  id: string;
  name: string;
  nameMm: string | null;
  revenue: number;
  count: number;
}

interface HourlyData {
  hour: number;
  label: string;
  count: number;
  revenue: number;
}

interface ReportData {
  summary: ReportSummary;
  dailySales: DailySale[];
  paymentBreakdown: PaymentBreakdown[];
  topProducts: TopProduct[];
  categoryBreakdown: CategoryBreakdown[];
  hourlyDistribution: HourlyData[];
}

/* ---------- Constants ---------- */

type DatePreset = 'today' | 'week' | 'month' | 'custom';

const PAYMENT_COLORS: Record<string, string> = {
  CASH: '#D4A843',
  CARD: '#22C55E',
  MOBILE_BANKING: '#3B82F6',
  CREDIT: '#A855F7',
};

const PAYMENT_LABELS: Record<string, { en: string; mm: string }> = {
  CASH: { en: 'Cash', mm: 'ငွေသား' },
  CARD: { en: 'Card', mm: 'ကတ်' },
  MOBILE_BANKING: { en: 'Mobile Banking', mm: 'မိုဘိုင်းဘဏ်' },
  CREDIT: { en: 'Credit', mm: 'အကြွေး' },
};

const CATEGORY_COLORS = [
  '#D4A843', '#22C55E', '#3B82F6', '#A855F7', '#F97316',
  '#EF4444', '#06B6D4', '#EC4899', '#84CC16', '#F59E0B',
];

/* ---------- Helper functions ---------- */

function getDateRange(preset: DatePreset): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split('T')[0];

  switch (preset) {
    case 'today':
      return { start: end, end };
    case 'week': {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - weekStart.getDay());
      return { start: weekStart.toISOString().split('T')[0], end };
    }
    case 'month': {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      return { start: monthStart.toISOString().split('T')[0], end };
    }
    default:
      return { start: end, end };
  }
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatCompact(value: number): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
  return String(value);
}

/* ---------- Custom Tooltips ---------- */

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-sm) var(--space-md)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}
      </div>
      {payload.map((p, i) => (
        <div
          key={i}
          style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--primary)' }}
        >
          {formatCurrency(p.value)}
        </div>
      ))}
    </div>
  );
}

function PieTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; payload: { count: number } }>;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const data = payload[0];
  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: 'var(--space-sm) var(--space-md)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
        {data.name}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--primary)' }}>
        {formatCurrency(data.value)}
      </div>
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
        {data.payload.count} sales
      </div>
    </div>
  );
}

/* ---------- Component ---------- */

export function ReportsClient() {
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

  const [preset, setPreset] = useState<DatePreset>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      let start: string;
      let end: string;

      if (preset === 'custom' && customStart && customEnd) {
        start = customStart;
        end = customEnd;
      } else if (preset !== 'custom') {
        const range = getDateRange(preset);
        start = range.start;
        end = range.end;
      } else {
        setLoading(false);
        return;
      }

      const res = await fetch(`/api/reports?startDate=${start}&endDate=${end}`);
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (err) {
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, [preset, customStart, customEnd]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // Auto-refresh when tab regains focus
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchReports();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [fetchReports]);

  const presetButtons: Array<{ key: DatePreset; en: string; mm: string }> = [
    { key: 'today', en: 'Today', mm: 'ယနေ့' },
    { key: 'week', en: 'This Week', mm: 'ဤအပတ်' },
    { key: 'month', en: 'This Month', mm: 'ဤလ' },
    { key: 'custom', en: 'Custom', mm: 'စိတ်ကြိုက်' },
  ];

  // Prepare pie chart data
  const pieData =
    data?.paymentBreakdown.map((p) => ({
      name: PAYMENT_LABELS[p.method]?.[language] || p.method,
      value: p.amount,
      count: p.count,
    })) || [];

  // Prepare category chart data
  const catData =
    data?.categoryBreakdown.map((c) => ({
      name: language === 'mm' && c.nameMm ? c.nameMm : c.name,
      revenue: c.revenue,
      count: c.count,
    })) || [];

  // Prepare hourly data - filter to relevant hours
  const hourlyData =
    data?.hourlyDistribution.filter(
      (h) => h.hour >= 6 && h.hour <= 22
    ) || [];

  return (
    <>
      {/* Page Header */}
      <div className="page-header">
        <div className="page-title-group">
          <h1 className="page-title">{t('Reports', 'အစီရင်ခံစာများ')}</h1>
          <p className="page-subtitle mm-text">
            {t('Analytics & Insights', 'ခွဲခြမ်းစိတ်ဖြာမှုများ')}
          </p>
        </div>
      </div>

      <div className="page-body">
        {/* Date Range Selector */}
        <div
          className="glass-card"
          style={{
            marginBottom: 'var(--space-lg)',
            padding: 'var(--space-md) var(--space-lg)',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-md)',
              flexWrap: 'wrap',
            }}
          >
            <span
              style={{
                fontSize: 'var(--text-sm)',
                color: 'var(--text-muted)',
                fontWeight: 600,
              }}
            >
              {t('Date Range', 'ရက်စွဲအပိုင်းအခြား')}:
            </span>
            {presetButtons.map((btn) => (
              <button
                key={btn.key}
                className={`btn btn-sm ${preset === btn.key ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPreset(btn.key)}
              >
                {t(btn.en, btn.mm)}
              </button>
            ))}
            {preset === 'custom' && (
              <>
                <input
                  type="date"
                  className="input"
                  style={{ width: 160, fontSize: 'var(--text-sm)' }}
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                />
                <span style={{ color: 'var(--text-muted)' }}>—</span>
                <input
                  type="date"
                  className="input"
                  style={{ width: 160, fontSize: 'var(--text-sm)' }}
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                />
              </>
            )}
          </div>
        </div>

        {loading ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">{t('Loading reports...', 'အစီရင်ခံစာများဖွင့်နေသည်...')}</div>
          </div>
        ) : !data ? (
          <div className="empty-state">
            <div className="empty-state-icon">📊</div>
            <div className="empty-state-title">{t('No data available', 'ဒေတာမရှိပါ')}</div>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="stats-grid" style={{ marginBottom: 'var(--space-xl)' }}>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(212,168,67,0.15)', color: '#D4A843' }}>
                  💰
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('Total Revenue', 'စုစုပေါင်းဝင်ငွေ')}</div>
                  <div className="stat-value">{formatCurrency(data.summary.totalRevenue)}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(34,197,94,0.15)', color: '#22C55E' }}>
                  📈
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('Total Profit', 'စုစုပေါင်းအမြတ်')}</div>
                  <div className="stat-value" style={{ color: data.summary.totalProfit >= 0 ? 'var(--success)' : 'var(--danger)' }}>
                    {formatCurrency(data.summary.totalProfit)}
                  </div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(59,130,246,0.15)', color: '#3B82F6' }}>
                  🧾
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('Total Sales', 'စုစုပေါင်းအရောင်း')}</div>
                  <div className="stat-value">{data.summary.totalSalesCount}</div>
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-icon" style={{ background: 'rgba(168,85,247,0.15)', color: '#A855F7' }}>
                  📊
                </div>
                <div className="stat-content">
                  <div className="stat-label">{t('Average Sale', 'ပျမ်းမျှအရောင်း')}</div>
                  <div className="stat-value">{formatCurrency(data.summary.averageSaleValue)}</div>
                </div>
              </div>
            </div>

            {/* Sales by Day Chart */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-xl)' }}>
              <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="heading-4">{t('Sales Trend', 'ရောင်းအားလမ်းကြောင်း')}</h3>
              </div>
              <div style={{ padding: 'var(--space-lg)', paddingTop: 'var(--space-md)' }}>
                <ResponsiveContainer width="100%" height={350}>
                  <AreaChart
                    data={data.dailySales.map((d) => ({
                      ...d,
                      date: formatShortDate(d.date),
                    }))}
                    margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="reportGoldGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#D4A843" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#D4A843" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(255,255,255,0.05)"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      dy={10}
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fill: '#64748B', fontSize: 12 }}
                      tickFormatter={formatCompact}
                      dx={-10}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="#D4A843"
                      strokeWidth={2.5}
                      fill="url(#reportGoldGradient)"
                      dot={false}
                      activeDot={{
                        r: 5,
                        fill: '#D4A843',
                        stroke: '#0D0D1A',
                        strokeWidth: 2,
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Two-Column: Payment Method Pie + Hourly Distribution */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 'var(--space-xl)',
                marginBottom: 'var(--space-xl)',
              }}
            >
              {/* Payment Method Pie */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h3 className="heading-4">
                    {t('Sales by Payment Method', 'ငွေပေးချေမှုအမျိုးအစားအလိုက်')}
                  </h3>
                </div>
                <div style={{ padding: 'var(--space-lg)' }}>
                  {pieData.length === 0 ? (
                    <div
                      style={{
                        height: 300,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--text-muted)',
                      }}
                    >
                      {t('No sales data', 'အရောင်းဒေတာမရှိပါ')}
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={pieData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={100}
                          paddingAngle={4}
                          dataKey="value"
                        >
                          {pieData.map((entry, index) => {
                            const method = data.paymentBreakdown[index]?.method || '';
                            return (
                              <Cell
                                key={`cell-${index}`}
                                fill={PAYMENT_COLORS[method] || CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                                stroke="transparent"
                              />
                            );
                          })}
                        </Pie>
                        <Tooltip content={<PieTooltip />} />
                        <Legend
                          wrapperStyle={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>

              {/* Hourly Distribution */}
              <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-subtle)' }}>
                  <h3 className="heading-4">
                    {t('Hourly Sales Distribution', 'နာရီအလိုက်ရောင်းအား')}
                  </h3>
                </div>
                <div style={{ padding: 'var(--space-lg)', paddingTop: 'var(--space-md)' }}>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="label"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B', fontSize: 10 }}
                        dy={10}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B', fontSize: 12 }}
                        dx={-10}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar
                        dataKey="revenue"
                        fill="#D4A843"
                        radius={[4, 4, 0, 0]}
                        maxBarSize={30}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Sales by Category */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden', marginBottom: 'var(--space-xl)' }}>
              <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="heading-4">
                  {t('Sales by Category', 'အမျိုးအစားအလိုက်ရောင်းအား')}
                </h3>
              </div>
              <div style={{ padding: 'var(--space-lg)', paddingTop: 'var(--space-md)' }}>
                {catData.length === 0 ? (
                  <div
                    style={{
                      height: 250,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {t('No category data', 'အမျိုးအစားဒေတာမရှိပါ')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart
                      data={catData}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="rgba(255,255,255,0.05)"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#64748B', fontSize: 12 }}
                        tickFormatter={formatCompact}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: '#94A3B8', fontSize: 12 }}
                        width={80}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="revenue" radius={[0, 4, 4, 0]} maxBarSize={24}>
                        {catData.map((_, index) => (
                          <Cell
                            key={`cat-${index}`}
                            fill={CATEGORY_COLORS[index % CATEGORY_COLORS.length]}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            {/* Top 10 Products Table */}
            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: 'var(--space-lg)', borderBottom: '1px solid var(--border-subtle)' }}>
                <h3 className="heading-4">
                  {t('Top 10 Products', 'ထိပ်တန်း ၁၀ မျိုး')}
                </h3>
              </div>
              <div style={{ padding: 0 }}>
                {data.topProducts.length === 0 ? (
                  <div
                    style={{
                      padding: 'var(--space-xl)',
                      textAlign: 'center',
                      color: 'var(--text-muted)',
                    }}
                  >
                    {t('No products sold in this period', 'ဤကာလအတွင်း ရောင်းထားသောကုန်ပစ္စည်းမရှိပါ')}
                  </div>
                ) : (
                  <div className="table-container">
                    <table className="table">
                      <thead>
                        <tr>
                          <th style={{ width: 40 }}>#</th>
                          <th>{t('Product', 'ကုန်ပစ္စည်း')}</th>
                          <th style={{ textAlign: 'right' }}>{t('Qty Sold', 'ရောင်းအရေအတွက်')}</th>
                          <th style={{ textAlign: 'right' }}>{t('Revenue', 'ဝင်ငွေ')}</th>
                          <th style={{ textAlign: 'right' }}>{t('Profit', 'အမြတ်')}</th>
                          <th style={{ textAlign: 'right' }}>{t('Margin', 'အမြတ်နှုန်း')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.topProducts.map((product, index) => (
                          <tr key={product.id}>
                            <td style={{ fontWeight: 700, color: 'var(--text-muted)' }}>
                              {index + 1}
                            </td>
                            <td>
                              <div>
                                <div style={{ fontWeight: 600 }}>{product.name}</div>
                                {product.nameMm && (
                                  <div
                                    className="mm-text"
                                    style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}
                                  >
                                    {product.nameMm}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-sm)',
                              }}
                            >
                              {product.qtySold}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-sm)',
                                fontWeight: 600,
                                color: 'var(--primary)',
                              }}
                            >
                              {formatCurrency(product.revenue)}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontFamily: 'var(--font-mono)',
                                fontSize: 'var(--text-sm)',
                                color: product.profit >= 0 ? 'var(--success)' : 'var(--danger)',
                              }}
                            >
                              {formatCurrency(product.profit)}
                            </td>
                            <td
                              style={{
                                textAlign: 'right',
                                fontSize: 'var(--text-sm)',
                              }}
                            >
                              <span
                                className={`badge ${product.profitMargin >= 30 ? 'badge-success' : product.profitMargin >= 15 ? 'badge-primary' : 'badge-neutral'}`}
                              >
                                {product.profitMargin}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
