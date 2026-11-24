'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { escapeCsvCell } from '@/lib/csv';
import { getPaymentMethodLabel } from '@/lib/saleHelpers';
import { printElementById, type PrintPaperSize } from '@/lib/print';
import { Printer, X, FileText } from '@/components/ui/Icons';

export interface PrintableReportData {
  summary: {
    totalRevenue: number;
    totalProfit: number;
    totalCost: number;
    totalExpenses?: number;
    netProfit?: number;
    totalSalesCount: number;
    averageSaleValue: number;
  };
  dailySales: Array<{
    date: string;
    revenue: number;
    count: number;
    profit: number;
    expenses?: number;
    netProfit?: number;
  }>;
  paymentBreakdown: Array<{
    method: string;
    count: number;
    amount: number;
  }>;
  topProducts: Array<{
    id: string;
    name: string;
    nameMm: string | null;
    sku: string;
    qtySold: number;
    revenue: number;
    cost: number;
    profit: number;
    profitMargin: number;
  }>;
}

export function downloadReportCsv(
  data: PrintableReportData,
  startDate: string,
  endDate: string
): void {
  const lines: string[] = [];
  const totalExpenses = data.summary.totalExpenses ?? 0;
  const netProfit = data.summary.netProfit ?? data.summary.totalProfit - totalExpenses;

  lines.push(escapeCsvCell(`ShwePOS Profit & Loss Report (${startDate} to ${endDate})`));
  lines.push('');
  lines.push(['Metric', 'Value'].map(escapeCsvCell).join(','));
  lines.push(['Total Sales Count', data.summary.totalSalesCount].map(escapeCsvCell).join(','));
  lines.push(['Total Revenue (MMK)', data.summary.totalRevenue].map(escapeCsvCell).join(','));
  lines.push(['Cost of Goods Sold (MMK)', data.summary.totalCost].map(escapeCsvCell).join(','));
  lines.push(['Gross Profit (MMK)', data.summary.totalProfit].map(escapeCsvCell).join(','));
  lines.push(['Total Expenses (MMK)', totalExpenses].map(escapeCsvCell).join(','));
  lines.push(['Net Profit (MMK)', netProfit].map(escapeCsvCell).join(','));
  lines.push(['Average Sale Value (MMK)', data.summary.averageSaleValue].map(escapeCsvCell).join(','));
  lines.push('');

  lines.push(['Payment Method', 'Count', 'Amount (MMK)'].map(escapeCsvCell).join(','));
  for (const pm of data.paymentBreakdown) {
    lines.push([pm.method, pm.count, pm.amount].map(escapeCsvCell).join(','));
  }
  lines.push('');

  lines.push(
    ['Date', 'Orders', 'Revenue (MMK)', 'Gross Profit (MMK)', 'Expenses (MMK)', 'Net Profit (MMK)']
      .map(escapeCsvCell)
      .join(',')
  );
  for (const d of data.dailySales) {
    lines.push(
      [
        d.date,
        d.count,
        d.revenue,
        d.profit,
        d.expenses ?? 0,
        d.netProfit ?? d.profit - (d.expenses ?? 0),
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  }
  lines.push('');

  lines.push(
    ['Rank', 'Product', 'SKU', 'Qty Sold', 'Revenue (MMK)', 'Cost (MMK)', 'Profit (MMK)', 'Margin (%)']
      .map(escapeCsvCell)
      .join(',')
  );
  data.topProducts.forEach((p, idx) => {
    lines.push(
      [idx + 1, p.name, p.sku, p.qtySold, p.revenue, p.cost, p.profit, `${p.profitMargin}%`]
        .map(escapeCsvCell)
        .join(',')
    );
  });

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], {
    type: 'text/csv;charset=utf-8;',
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shwepos-report-${startDate}-to-${endDate}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

interface ReportSummaryPrintModalProps {
  isOpen: boolean;
  data: PrintableReportData | null;
  startDate: string;
  endDate: string;
  onClose: () => void;
}

export function ReportSummaryPrintModal({
  isOpen,
  data,
  startDate,
  endDate,
  onClose,
}: ReportSummaryPrintModalProps) {
  const { t } = useI18n();
  const { businessName, businessNameMm, address, phone } = useSettingsStore();
  const [paperSize, setPaperSize] = useState<PrintPaperSize>('A4');

  if (!isOpen || !data) return null;

  const totalExpenses = data.summary.totalExpenses ?? 0;
  const netProfit = data.summary.netProfit ?? data.summary.totalProfit - totalExpenses;

  const handlePrint = () => {
    void printElementById('report-pnl-print-area', {
      title: `P&L Report (${startDate} - ${endDate})`,
      paperSize,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 680 }}
      >
        <div className="modal-header">
          <span
            className="modal-title"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <FileText size={18} strokeWidth={1.75} />
            {t('Print P&L Summary Report', 'အရှုံးအမြတ် အနှစ်ချုပ် ပရင့်ထုတ်ရန်')}
          </span>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={onClose}
            aria-label={t('close')}
          >
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6 }}>
            <button
              type="button"
              className={`btn btn-sm ${paperSize === 'A4' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPaperSize('A4')}
            >
              A4 Statement
            </button>
            <button
              type="button"
              className={`btn btn-sm ${paperSize === '80mm' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPaperSize('80mm')}
            >
              80mm Thermal
            </button>
          </div>

          <div
            id="report-pnl-print-area"
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: paperSize === '80mm' ? '14px' : '24px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              fontFamily: paperSize === '80mm' ? "'Courier New', Courier, monospace" : 'Arial, sans-serif',
              fontSize: paperSize === '80mm' ? '11px' : '13px',
              lineHeight: 1.5,
              maxWidth: paperSize === '80mm' ? 310 : '100%',
              margin: '0 auto',
              width: '100%',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <div style={{ fontWeight: 700, fontSize: paperSize === '80mm' ? 15 : 18 }}>
                {businessName}
              </div>
              {businessNameMm && <div style={{ fontSize: 12 }}>{businessNameMm}</div>}
              {address && <div style={{ fontSize: 11 }}>{address}</div>}
              {phone && <div style={{ fontSize: 11 }}>Tel: {phone}</div>}
              <div
                style={{
                  marginTop: 8,
                  padding: '4px 0',
                  borderTop: '1px dashed #000',
                  borderBottom: '1px dashed #000',
                  fontWeight: 700,
                }}
              >
                PROFIT & LOSS SUMMARY (အရှုံးအမြတ် အနှစ်ချုပ်)
                <div style={{ fontSize: 11, fontWeight: 400 }}>
                  {startDate} — {endDate}
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Total Sales Orders:</span>
                <strong>{data.summary.totalSalesCount}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Total Revenue (စုစုပေါင်းဝင်ငွေ):</span>
                <strong>{formatCurrency(data.summary.totalRevenue)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Cost of Goods Sold (COGS):</span>
                <span>-{formatCurrency(data.summary.totalCost)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px dashed #000',
                  paddingTop: 4,
                  marginTop: 4,
                  fontWeight: 700,
                }}
              >
                <span>Gross Profit (အကြမ်းအမြတ်):</span>
                <span>{formatCurrency(data.summary.totalProfit)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
                <span>Operating Expenses (အသုံးစရိတ်):</span>
                <span>-{formatCurrency(totalExpenses)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '2px solid #000',
                  paddingTop: 6,
                  marginTop: 6,
                  fontWeight: 700,
                  fontSize: paperSize === '80mm' ? 13 : 15,
                }}
              >
                <span>NET PROFIT (အသားတင်အမြတ်):</span>
                <span>{formatCurrency(netProfit)}</span>
              </div>
            </div>

            {data.paymentBreakdown.length > 0 && (
              <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginBottom: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Payment Breakdown</div>
                {data.paymentBreakdown.map((pm) => (
                  <div
                    key={pm.method}
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}
                  >
                    <span>
                      {getPaymentMethodLabel(pm.method, t)} ({pm.count})
                    </span>
                    <span>{formatCurrency(pm.amount)}</span>
                  </div>
                ))}
              </div>
            )}

            {data.topProducts.length > 0 && (
              <div style={{ borderTop: '1px dashed #000', paddingTop: 8, marginBottom: 10 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>Top Products</div>
                {data.topProducts.slice(0, 10).map((p, idx) => (
                  <div
                    key={p.id}
                    style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2, gap: 8 }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {idx + 1}. {p.name} (×{p.qtySold})
                    </span>
                    <span style={{ flexShrink: 0 }}>{formatCurrency(p.revenue)}</span>
                  </div>
                ))}
              </div>
            )}

            <div style={{ borderTop: '1px dashed #000', paddingTop: 6, textAlign: 'center', fontSize: 10 }}>
              Printed: {formatDateTime(new Date().toISOString())}
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Close', 'ပိတ်ရန်')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handlePrint}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} strokeWidth={1.75} />
            {t('Print Report', 'အစီရင်ခံစာ ပရင့်ထုတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
