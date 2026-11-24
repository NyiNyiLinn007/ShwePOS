'use client';

import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { formatCurrency, formatDate, getMyanmarDateKey } from '@/lib/utils';
import { escapeCsvCell } from '@/lib/csv';
import { printElementById } from '@/lib/print';
import { Download, Printer, RefreshCw, Users, Truck } from '@/components/ui/Icons';
import type { AgingAccountRow, AgingReport } from '@/services/agingService';

function downloadAgingCsv(report: AgingReport) {
  const lines = [
    ['Type', 'Account', 'Phone', '0-30 Days', '31-60 Days', '61-90 Days', '90+ Days', 'Total Due'].map(escapeCsvCell).join(','),
    ...report.receivables.map((r) =>
      ['AR (Customer)', r.name, r.phone || '', r.d0_30, r.d31_60, r.d61_90, r.d90_plus, r.totalDue].map(escapeCsvCell).join(',')
    ),
    ...report.payables.map((p) =>
      ['AP (Supplier)', p.name, p.phone || '', p.d0_30, p.d31_60, p.d61_90, p.d90_plus, p.totalDue].map(escapeCsvCell).join(',')
    ),
  ];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `shwepos-aging-${getMyanmarDateKey()}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function AgingReportTab() {
  const { t } = useI18n();
  const { addToast } = useToast();

  const [data, setData] = useState<AgingReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'AR' | 'AP'>('AR');

  const tRef = useRef(t);
  tRef.current = t;

  const fetchAging = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/reports/aging');
      if (res.ok) setData(await res.json());
    } catch {
      addToast(tRef.current('Failed to load aging report', 'အကြွေးသက်တမ်းစစ်တမ်း ဖတ်မရပါ'), 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    void fetchAging();
  }, [fetchAging]);

  if (loading && !data) {
    return (
      <div className="empty-state">
        <div className="loading-spinner" />
      </div>
    );
  }
  if (!data) return null;

  const activeRows: AgingAccountRow[] = view === 'AR' ? data.receivables : data.payables;
  const activeSummary = view === 'AR' ? data.receivablesSummary : data.payablesSummary;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
      {/* Toggle & Export */}
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 10 }}>
        <div className="flex gap-xs">
          <button
            type="button"
            className={`btn btn-sm ${view === 'AR' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('AR')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Users size={14} />
            {t('Customer Receivables (AR)', 'ဖောက်သည်ရရန်အကြွေး (AR)')} ({data.receivablesSummary.accountCount})
          </button>
          <button
            type="button"
            className={`btn btn-sm ${view === 'AP' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setView('AP')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Truck size={14} />
            {t('Supplier Payables (AP)', 'ပေးသွင်းသူပေးရန်အကြွေး (AP)')} ({data.payablesSummary.accountCount})
          </button>
        </div>
        <div className="flex gap-xs">
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => downloadAgingCsv(data)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Download size={14} />
            CSV
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() =>
              printElementById('aging-report-print', {
                title: view === 'AR' ? 'Accounts Receivable Aging' : 'Accounts Payable Aging',
                paperSize: 'A4',
              })
            }
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={14} />
            {t('Print A4', 'A4 ထုတ်ရန်')}
          </button>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => void fetchAging()}
          >
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Printable Body */}
      <div id="aging-report-print" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-lg)' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 'var(--space-md)' }}>
          <div className="kpi-card">
            <div className="kpi-label">0–30 {t('Days', 'ရက်')}</div>
            <div className="kpi-value">{formatCurrency(activeSummary.d0_30)}</div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">31–60 {t('Days', 'ရက်')}</div>
            <div className="kpi-value" style={{ color: activeSummary.d31_60 > 0 ? 'var(--warning)' : undefined }}>
              {formatCurrency(activeSummary.d31_60)}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">61–90 {t('Days', 'ရက်')}</div>
            <div className="kpi-value" style={{ color: activeSummary.d61_90 > 0 ? 'var(--warning)' : undefined }}>
              {formatCurrency(activeSummary.d61_90)}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">90+ {t('Days (Overdue)', 'ရက် (ကျော်လွန်)')}</div>
            <div className="kpi-value" style={{ color: activeSummary.d90_plus > 0 ? 'var(--danger)' : undefined }}>
              {formatCurrency(activeSummary.d90_plus)}
            </div>
          </div>
          <div className="kpi-card">
            <div className="kpi-label">{t('Total Outstanding', 'စုစုပေါင်းကြွေးကျန်')}</div>
            <div className="kpi-value" style={{ color: 'var(--primary)' }}>
              {formatCurrency(activeSummary.totalDue)}
            </div>
          </div>
        </div>

        <div className="glass-card">
          {activeRows.length === 0 ? (
            <div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>
              {view === 'AR'
                ? t('No outstanding customer receivables.', 'ဖောက်သည်ကြွေးကျန် မရှိပါ။')
                : t('No outstanding supplier payables.', 'ပေးသွင်းသူကြွေးကျန် မရှိပါ။')}
            </div>
          ) : (
            <div className="table-container">
              <table className="table">
                <thead>
                  <tr>
                    <th>{view === 'AR' ? t('Customer', 'ဖောက်သည်') : t('Supplier', 'ပေးသွင်းသူ')}</th>
                    <th>{t('Oldest Invoice', 'အဟောင်းဆုံးရက်')}</th>
                    <th style={{ textAlign: 'right' }}>0–30d</th>
                    <th style={{ textAlign: 'right' }}>31–60d</th>
                    <th style={{ textAlign: 'right' }}>61–90d</th>
                    <th style={{ textAlign: 'right' }}>90+d</th>
                    <th style={{ textAlign: 'right' }}>{t('Total Due', 'စုစုပေါင်း')}</th>
                  </tr>
                </thead>
                <tbody>
                  {activeRows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{row.name}</div>
                        {row.phone && (
                          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                            {row.phone}
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 'var(--text-xs)' }}>
                        {row.oldestDate ? formatDate(row.oldestDate) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)' }}>
                        {row.d0_30 > 0 ? formatCurrency(row.d0_30) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.d31_60 > 0 ? 'var(--warning)' : undefined }}>
                        {row.d31_60 > 0 ? formatCurrency(row.d31_60) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', color: row.d61_90 > 0 ? 'var(--warning)' : undefined }}>
                        {row.d61_90 > 0 ? formatCurrency(row.d61_90) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: row.d90_plus > 0 ? 700 : 400, color: row.d90_plus > 0 ? 'var(--danger)' : undefined }}>
                        {row.d90_plus > 0 ? formatCurrency(row.d90_plus) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'var(--font-mono)', fontWeight: 700, color: 'var(--danger)' }}>
                        {formatCurrency(row.totalDue)}
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
