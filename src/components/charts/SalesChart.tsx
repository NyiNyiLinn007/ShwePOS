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
import { useSettingsStore } from '@/stores/settingsStore';
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
        padding: 'var(--space-sm) var(--space-md)',
        boxShadow: 'var(--shadow-lg)',
      }}
    >
      <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 'var(--text-sm)', fontWeight: 700, color: 'var(--primary)' }}>
        {formatCurrency(payload[0].value)}
      </div>
    </div>
  );
}

export default function SalesChart({ data }: SalesChartProps) {
  const { t } = useSettingsStore();

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: 'var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <h3 className="heading-4">
          {t('Sales Overview', 'ရောင်းအားခြုံငုံသုံးသပ်ချက်')}
        </h3>
      </div>
      <div style={{ padding: 'var(--space-lg)', paddingTop: 'var(--space-md)' }}>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="goldGradient" x1="0" y1="0" x2="0" y2="1">
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
              stroke="#D4A843"
              strokeWidth={2.5}
              fill="url(#goldGradient)"
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
  );
}
