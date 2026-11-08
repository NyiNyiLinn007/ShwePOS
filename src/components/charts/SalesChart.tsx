'use client';

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useI18n } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';

interface SalesDataPoint {
  date: string;
  amount: number;
}

interface SalesChartProps {
  data: SalesDataPoint[];
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}) {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-md)',
        padding: '6px 10px',
        boxShadow: 'var(--shadow-md)',
      }}
    >
      <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600, color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums' }}>
        {formatCurrency(payload[0].value)}
      </div>
    </div>
  );
}

export default function SalesChart({ data }: SalesChartProps) {
  const { t } = useI18n();

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
          {t('Sales Overview', 'ရောင်းအားခြုံငုံသုံးသပ်ချက်')}
        </h3>
      </div>
      <div style={{ padding: 'var(--space-lg)', paddingTop: 'var(--space-md)' }}>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D97706" stopOpacity={0.22} />
                <stop offset="95%" stopColor="#D97706" stopOpacity={0.01} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border-subtle)"
              vertical={false}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11 }}
              dy={10}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: '#64748B', fontSize: 11 }}
              tickFormatter={(value: number) => {
                if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
                if (value >= 1000) return `${(value / 1000).toFixed(0)}K`;
                return String(value);
              }}
              dx={-10}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="amount"
              stroke="#D97706"
              strokeWidth={2}
              fill="url(#goldGradient)"
              dot={false}
              activeDot={{
                r: 4,
                fill: '#D97706',
                stroke: 'var(--bg-primary)',
                strokeWidth: 2,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
