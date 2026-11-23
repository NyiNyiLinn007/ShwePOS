'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency, formatDateTime } from '@/lib/utils';
import { printElementById, type PrintPaperSize } from '@/lib/print';
import { Printer, X, CheckCircle2 } from '@/components/ui/Icons';

export interface DebtRepaymentReceiptData {
  paymentId: string;
  customerName: string;
  customerPhone: string | null;
  previousBalance: number;
  paidAmount: number;
  newCreditBalance: number;
  method: 'CASH' | 'CARD' | 'MOBILE_BANKING';
  reference: string | null;
  notes: string | null;
  receivedBy: string;
  paidAt: string;
}

interface DebtRepaymentReceiptModalProps {
  data: DebtRepaymentReceiptData | null;
  onClose: () => void;
}

export function DebtRepaymentReceiptModal({
  data,
  onClose,
}: DebtRepaymentReceiptModalProps) {
  const { t } = useI18n();
  const { businessName, businessNameMm, address, phone, logo, receiptFooter } =
    useSettingsStore();
  const [paperSize, setPaperSize] = useState<PrintPaperSize>('80mm');

  if (!data) return null;

  const methodLabel =
    data.method === 'CASH'
      ? t('Cash', 'ငွေသား')
      : data.method === 'CARD'
        ? t('Card', 'ကတ်')
        : t('Mobile Banking', 'မိုဘိုင်းဘဏ်');

  const handlePrint = () => {
    void printElementById('debt-repayment-receipt', {
      title: `Repayment Receipt - ${data.customerName}`,
      paperSize,
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 420 }}
      >
        <div className="modal-header">
          <span
            className="modal-title"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}
          >
            <CheckCircle2 size={18} strokeWidth={1.75} style={{ color: 'var(--success)' }} />
            {t('Debt Repayment Receipt', 'အကြွေးဆပ်ပြေစာ')}
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
              className={`btn btn-sm ${paperSize === '80mm' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPaperSize('80mm')}
            >
              80mm Thermal
            </button>
            <button
              type="button"
              className={`btn btn-sm ${paperSize === '58mm' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPaperSize('58mm')}
            >
              58mm Thermal
            </button>
          </div>

          <div
            id="debt-repayment-receipt"
            style={{
              background: '#ffffff',
              color: '#000000',
              padding: '16px',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-default)',
              fontFamily: "'Courier New', Courier, monospace",
              fontSize: '12px',
              lineHeight: 1.5,
              maxWidth: paperSize === '58mm' ? 230 : 320,
              margin: '0 auto',
              width: '100%',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: 8 }}>
              {logo && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={logo}
                  alt={businessName}
                  style={{ maxHeight: 42, maxWidth: 120, margin: '0 auto 6px', display: 'block', objectFit: 'contain' }}
                />
              )}
              <div style={{ fontWeight: 700, fontSize: 15 }}>{businessName}</div>
              {businessNameMm && <div style={{ fontSize: 11 }}>{businessNameMm}</div>}
              {address && <div style={{ fontSize: 10 }}>{address}</div>}
              {phone && <div style={{ fontSize: 10 }}>Tel: {phone}</div>}
              <div
                style={{
                  marginTop: 6,
                  padding: '3px 6px',
                  borderTop: '1px dashed #000',
                  borderBottom: '1px dashed #000',
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                DEBT REPAYMENT RECEIPT
                <div style={{ fontSize: 10, fontWeight: 400 }}>အကြွေးဆပ်ပြေစာ</div>
              </div>
            </div>

            <div style={{ fontSize: 11, marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Receipt #:</span>
                <span>{data.paymentId.slice(-8).toUpperCase()}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Date:</span>
                <span>{formatDateTime(data.paidAt)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Customer:</span>
                <span style={{ fontWeight: 700 }}>{data.customerName}</span>
              </div>
              {data.customerPhone && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Phone:</span>
                  <span>{data.customerPhone}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Received By:</span>
                <span>{data.receivedBy}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', paddingTop: 6, marginTop: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span>Previous Debt (ယခင်ကြွေးကျန်):</span>
                <span>{formatCurrency(data.previousBalance)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontWeight: 700, fontSize: 13 }}>
                <span>Amount Paid (ပေးဆပ်ငွေ):</span>
                <span>-{formatCurrency(data.paidAmount)}</span>
              </div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderTop: '1px solid #000',
                  paddingTop: 5,
                  marginTop: 5,
                  fontWeight: 700,
                  fontSize: 13,
                }}
              >
                <span>Remaining Debt (လက်ကျန်):</span>
                <span>{formatCurrency(data.newCreditBalance)}</span>
              </div>
            </div>

            <div style={{ borderTop: '1px dashed #000', paddingTop: 6, marginTop: 8, fontSize: 11 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Method:</span>
                <span>{methodLabel}</span>
              </div>
              {data.reference && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>Ref:</span>
                  <span>{data.reference}</span>
                </div>
              )}
              {data.notes && (
                <div style={{ marginTop: 4 }}>
                  <span>Note: {data.notes}</span>
                </div>
              )}
            </div>

            <div style={{ borderTop: '1px dashed #000', marginTop: 10, paddingTop: 6, textAlign: 'center', fontSize: 10 }}>
              {receiptFooter || 'Thank you! / ကျေးဇူးတင်ပါသည်!'}
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
            {t('Print Receipt', 'ပြေစာ ပရင့်ထုတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
