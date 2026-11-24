'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useToast } from '@/contexts/ToastContext';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency, formatDate, formatDateTime } from '@/lib/utils';
import { getPaymentMethodLabel } from '@/lib/saleHelpers';
import { printElementById, type PrintPaperSize } from '@/lib/print';
import { Copy, FileText, Printer, X } from '@/components/ui/Icons';
import type { CustomerData } from '@/components/customers/CustomerModals';

interface CustomerCreditStatementModalProps {
  customer: CustomerData | null;
  onClose: () => void;
}

export function CustomerCreditStatementModal({
  customer,
  onClose,
}: CustomerCreditStatementModalProps) {
  const { language, t } = useI18n();
  const { addToast } = useToast();
  const businessName = useSettingsStore((s) => s.businessName);
  const businessNameMm = useSettingsStore((s) => s.businessNameMm);
  const businessPhone = useSettingsStore((s) => s.phone);
  const businessAddress = useSettingsStore((s) => s.address);
  const mobileBankingName = useSettingsStore((s) => s.mobileBankingName);

  const [paperSize, setPaperSize] = useState<PrintPaperSize>('A4');

  if (!customer) return null;

  const creditSales = customer.recentSales.filter(
    (s) =>
      (s.status === 'COMPLETED' || s.status === 'PARTIALLY_REFUNDED') &&
      ((s.dueAmount ?? 0) > 0 || s.paymentMethod === 'CREDIT')
  );
  const repayments = customer.repayments ?? [];
  const currentBalance = customer.creditBalance ?? 0;

  async function handleCopyReminder() {
    if (!customer) return;
    const shopLabel = language === 'mm' && businessNameMm ? businessNameMm : businessName;
    const msg =
      language === 'mm'
        ? `မင်္ဂလာပါ ${customer.name} — ${shopLabel} မှ အကြွေးရှင်းတမ်း သတိပေးအကြောင်းကြားအပ်ပါသည်။ လက်ရှိ ကျန်ရှိငွေပမာဏမှာ ${formatCurrency(currentBalance)} ဖြစ်ပါသည်။${mobileBankingName ? ` (${mobileBankingName} ဖြင့် လွှဲပေးနိုင်ပါသည်)` : ''}${businessPhone ? ` ဆက်သွယ်ရန်: ${businessPhone}` : ''} ကျေးဇူးတင်ပါသည်။`
        : `Hello ${customer.name}, friendly reminder from ${shopLabel} regarding your outstanding credit balance of ${formatCurrency(currentBalance)}.${mobileBankingName ? ` You can transfer via ${mobileBankingName}.` : ''}${businessPhone ? ` Contact: ${businessPhone}.` : ''} Thank you!`;

    try {
      await navigator.clipboard.writeText(msg);
      addToast(
        t(
          'Reminder message copied for Viber / SMS',
          'Viber / SMS ပို့ရန် သတိပေးစာသား Copy ကူးပြီးပါပြီ'
        ),
        'success'
      );
    } catch {
      addToast(t('Could not copy to clipboard', 'Copy ကူးမရပါ'), 'error');
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 680 }}>
        <div className="modal-header">
          <h2 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <FileText size={18} strokeWidth={1.75} />
            {t('Credit Statement', 'အကြွေးရှင်းတမ်း')} — {customer.name}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>

        <div className="modal-body">
          {/* Paper size selector & Reminder Copy */}
          <div
            className="flex justify-between items-center"
            style={{ marginBottom: 'var(--space-md)', flexWrap: 'wrap', gap: 8 }}
          >
            <div className="flex gap-xs">
              {(['A4', '80mm'] as PrintPaperSize[]).map((sz) => (
                <button
                  key={sz}
                  type="button"
                  className={`btn btn-sm ${paperSize === sz ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setPaperSize(sz)}
                >
                  {sz}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleCopyReminder}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
            >
              <Copy size={14} strokeWidth={1.75} />
              {t('Copy Viber/SMS Reminder', 'Viber/SMS သတိပေးစာ Copy ကူးရန်')}
            </button>
          </div>

          {/* Printable Statement */}
          <div
            id="customer-credit-statement-print"
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: paperSize === '80mm' ? 12 : 24,
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-color)',
              maxWidth: paperSize === '80mm' ? 320 : '100%',
              margin: '0 auto',
            }}
          >
            <div style={{ textAlign: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: 10, marginBottom: 12 }}>
              <div style={{ fontSize: paperSize === '80mm' ? 14 : 18, fontWeight: 800 }}>
                {businessName}
                {businessNameMm ? ` (${businessNameMm})` : ''}
              </div>
              {businessAddress && <div style={{ fontSize: 11, color: '#334155' }}>{businessAddress}</div>}
              {businessPhone && <div style={{ fontSize: 11, color: '#334155' }}>Tel: {businessPhone}</div>}
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 6, textTransform: 'uppercase' }}>
                {t('Customer Credit Statement', 'ဖောက်သည် အကြွေးရှင်းတမ်း')}
              </div>
              <div style={{ fontSize: 11, color: '#475569' }}>
                {t('Statement Date', 'ထုတ်ပေးသည့်ရက်')}: {formatDate(new Date())}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: 8,
                marginBottom: 14,
                fontSize: 12,
              }}
            >
              <div>
                <div>
                  <strong>{t('Customer', 'ဖောက်သည်')}:</strong> {customer.name}
                </div>
                {customer.phone && (
                  <div>
                    <strong>{t('Phone', 'ဖုန်း')}:</strong> {customer.phone}
                  </div>
                )}
                {customer.address && (
                  <div>
                    <strong>{t('Address', 'လိပ်စာ')}:</strong> {customer.address}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 11, color: '#475569' }}>
                  {t('Outstanding Balance', 'လက်ရှိကြွေးကျန်')}
                </div>
                <div style={{ fontSize: 18, fontWeight: 800, fontFamily: 'monospace' }}>
                  {formatCurrency(currentBalance)}
                </div>
              </div>
            </div>

            <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
              {t('Credit Invoices', 'အကြွေးဘောင်ချာများ')} ({creditSales.length})
            </div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 14 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #0f172a' }}>
                  <th style={{ textAlign: 'left', padding: '4px 2px' }}>{t('Invoice', 'ဘောင်ချာ')}</th>
                  <th style={{ textAlign: 'left', padding: '4px 2px' }}>{t('Date', 'ရက်စွဲ')}</th>
                  <th style={{ textAlign: 'right', padding: '4px 2px' }}>{t('Total', 'စုစုပေါင်း')}</th>
                  <th style={{ textAlign: 'right', padding: '4px 2px' }}>{t('Due', 'ကျန်ငွေ')}</th>
                </tr>
              </thead>
              <tbody>
                {creditSales.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: 8, color: '#64748b' }}>
                      {t('No unpaid credit invoices listed', 'မရှင်းရသေးသော အကြွေးဘောင်ချာမရှိပါ')}
                    </td>
                  </tr>
                ) : (
                  creditSales.map((s) => (
                    <tr key={s.id} style={{ borderBottom: '1px dashed #cbd5e1' }}>
                      <td style={{ padding: '4px 2px', fontFamily: 'monospace' }}>{s.invoiceNumber}</td>
                      <td style={{ padding: '4px 2px' }}>{formatDate(s.createdAt)}</td>
                      <td style={{ textAlign: 'right', padding: '4px 2px', fontFamily: 'monospace' }}>
                        {formatCurrency(s.totalAmount)}
                      </td>
                      <td style={{ textAlign: 'right', padding: '4px 2px', fontFamily: 'monospace', fontWeight: 700 }}>
                        {formatCurrency(s.dueAmount ?? 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>

            {repayments.length > 0 && (
              <>
                <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 6 }}>
                  {t('Recent Repayments', 'လတ်တလော အကြွေးပြန်ဆပ်မှုများ')}
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 11, marginBottom: 14 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #0f172a' }}>
                      <th style={{ textAlign: 'left', padding: '4px 2px' }}>{t('Date', 'ရက်စွဲ')}</th>
                      <th style={{ textAlign: 'left', padding: '4px 2px' }}>{t('Method', 'နည်းလမ်း')}</th>
                      <th style={{ textAlign: 'right', padding: '4px 2px' }}>{t('Paid', 'ပေးဆပ်ငွေ')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {repayments.slice(0, 10).map((r) => (
                      <tr key={r.id} style={{ borderBottom: '1px dashed #cbd5e1' }}>
                        <td style={{ padding: '4px 2px' }}>{formatDateTime(r.createdAt)}</td>
                        <td style={{ padding: '4px 2px' }}>{getPaymentMethodLabel(r.method, t)}</td>
                        <td style={{ textAlign: 'right', padding: '4px 2px', fontFamily: 'monospace', fontWeight: 700 }}>
                          {formatCurrency(r.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </>
            )}

            <div
              style={{
                borderTop: '2px solid #0f172a',
                paddingTop: 8,
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                fontSize: 14,
              }}
            >
              <span>{t('TOTAL BALANCE DUE', 'စုစုပေါင်း ပေးရန်ကြွေးကျန်')}</span>
              <span style={{ fontFamily: 'monospace' }}>{formatCurrency(currentBalance)}</span>
            </div>
            {mobileBankingName && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#334155', textAlign: 'center' }}>
                {t('Mobile Banking Transfer', 'မိုဘိုင်းဘဏ်လွှဲရန်')}: {mobileBankingName}
              </div>
            )}
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            {t('Close', 'ပိတ်ရန်')}
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={() =>
              printElementById('customer-credit-statement-print', {
                title: `Credit Statement - ${customer.name}`,
                paperSize,
              })
            }
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} strokeWidth={1.75} />
            {t('Print Statement', 'အကြွေးရှင်းတမ်း ထုတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
