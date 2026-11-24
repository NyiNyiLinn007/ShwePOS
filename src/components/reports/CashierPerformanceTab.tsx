'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency } from '@/lib/utils';
import { printElementById } from '@/lib/print';
import { Download, Printer, UserCog } from '@/components/ui/Icons';
import type { CashierPerformanceReport } from '@/services/cashierAnalyticsService';

function downloadCashierCsv(report: CashierPerformanceReport) {
  const esc = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [
    [
      'Staff Name',
      'Role',
      'Invoices',
      'Net Sales',
      'Avg Basket',
      'Discounts',
      'Price Overrides',
      'Voids/Refunds',
      'Void/Refund Amt',
      'Closed Shifts',
      'Net Cash Variance',
    ]
      .map(esc)
      .join(','),
    ...report.cashiers.map((c) =>
      [
        c.name,
        c.role,
        c.invoiceCount,
        c.netSales,
        c.avgBasketSize,
        c.totalDiscounts,
        c.priceOverrideCount,
        c.voidRefundCount,
        c.voidRefundAmount,
        c.closedShiftCount,
        c.netCashVariance,
      ]
        .map(esc)
        .join(',')
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shwepos-cashier-performance-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function CashierPerformanceTab({
  startDate,
  endDate,
}: {
  startDate: string;
  endDate: string;
}) {
  const { t } = useI18n();
  const { addToast } = useToast();
  const [data, setData] = useState<CashierPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchPerf = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/reports/cashier-performance?startDate=${startDate}&endDate=${endDate}`
      );
      if (res.ok) setData(await res.json());
    } catch {
      addToast(t('Failed to load cashier analytics', 'ဝန်ထမ်းစွမ်းဆောင်ရည် ဖတ်မရပါ'), 'error');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate, addToast, t]);

  useEffect(() => {
    void fetchPerf();
  }, [fetchPerf]);

  if (loading && !data) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" />
      </div>
    );
  }
  if (!data) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
          {t('Period', 'ကာလ')}: <strong>{startDate}</strong> – <strong>{endDate}</strong>
        </div>
        <div className="flex gap-xs">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadCashierCsv(data)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} />
            CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              printElementById('cashier-perf-print', {
                title: `Cashier Performance (${startDate} - ${endDate})`,
                paperSize: 'A4',
              })
            }
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={14} />
            {t('Print A4', 'A4 ထုတ်ရန်')}
          </button>
        </div>
      </div>

      <div id="cashier-perf-print" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(175px, 1fr))', gap: 'var(--space-md)' }}>
          <div className="kpi-card">
            <div className="kpi-label">{t('Total Net Sales', 'စုစုပေါင်းအရောင်း')}</div>
            <div className="kpi-value" style={{ color: 'var(--primary)' }}>
              {formatCurrency(data.totals.totalNetSales)}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t('Price Overrides', 'ဈေးပြင်ရောင်းအကြိမ်')}</div>
            <div className="kpi-value" style={{ color: data.totals.totalOverrides > 0 ? 'var(--warning)' : undefined }}>
              {data.totals.totalOverrides}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t('Voids & Refunds', 'ပယ်ဖျက်/ပြန်အမ်း')}</div>
            <div className="kpi-value" style={{ color: data.totals.totalVoidRefunds > 0 ? 'var(--danger)' : undefined }}>
              {data.totals.totalVoidRefunds}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t('Net Cash Variance', 'အံဆွဲငွေကွာဟမှု')}</div>
            <div
              className="kpi-value"
              style={{
                color:
                  data.totals.netCashVariance < 0
                    ? 'var(--danger)'
                    : data.totals.netCashVariance > 0
                      ? 'var(--success)'
                      : undefined,
              }}
            >
              {data.totals.netCashVariance > 0 ? '+' : ''}
              {formatCurrency(data.totals.netCashVariance)}
            </div>
          </div>
        </div>

        <div className="glass-card">
          <h3 className="heading-4" style={{ marginBottom: 'var(--space-md)', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <UserCog size={18} />
            {t('Staff Sales & Risk Audit Breakdown', 'ဝန်ထမ်းအလိုက် အရောင်းနှင့် စိစစ်မှုဇယား')}
          </h3>
          {data.cashiers.length === 0 ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
              {t('No staff activity recorded in this period.', 'ဤကာလအတွင်း ဝန်ထမ်းအရောင်းမှတ်တမ်း မရှိပါ။')}
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{t('Staff', 'ဝန်ထမ်း')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Invoices', 'ဘောင်ချာ')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Net Sales', 'အရောင်း')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Avg Basket', 'ပျမ်းမျှ')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Discounts', 'လျှော့ဈေး')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Overrides', 'ဈေးပြင်')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Void/Refund', 'ပယ်/ပြန်အမ်း')}</th>
                    <th style={{ textAlign: 'right' }}>{t('Shift Variance', 'ငွေကွာဟမှု')}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.cashiers.map((c) => (
                    <tr key={c.userId}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.name}</div>
                        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                          {c.role} · {c.closedShiftCount} {t('shift(s)', 'အဆိုင်း')}
                        </div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>{c.invoiceCount}</td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--primary)' }}>
                        {formatCurrency(c.netSales)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(c.avgBasketSize)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {formatCurrency(c.totalDiscounts)}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: c.priceOverrideCount > 0 ? 'var(--warning)' : 'var(--text-muted)', fontWeight: c.priceOverrideCount > 0 ? 700 : 400 }}>
                        {c.priceOverrideCount}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: c.voidRefundCount > 0 ? 'var(--danger)' : 'var(--text-muted)' }}>
                        {c.voidRefundCount > 0 ? `${c.voidRefundCount} (${formatCurrency(c.voidRefundAmount)})` : '0'}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          fontFamily: 'var(--font-mono)',
                          fontWeight: 700,
                          color:
                            c.netCashVariance < 0
                              ? 'var(--danger)'
                              : c.netCashVariance > 0
                                ? 'var(--success)'
                                : 'var(--text-muted)',
                        }}
                      >
                        {c.netCashVariance > 0 ? '+' : ''}
                        {formatCurrency(c.netCashVariance)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
