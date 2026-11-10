'use client';

import { useState } from 'react';
import { formatCurrency, formatDateTime, formatQuantity } from '@/lib/utils';
import { printElementById } from '@/lib/print';
import { useSettingsStore } from '@/store/settingsStore';
import { useI18n } from '@/lib/i18n';
import { Printer, WifiOff, Plus } from '@/components/ui/Icons';

export interface ReceiptData {
  invoiceNumber: string;
  createdAt: string;
  cashierName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    total: number;
    unit?: string;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paidAmount: number;
  dueAmount?: number;
  changeAmount: number;
  pointsEarned?: number;
  pointsRedeemed?: number;
  customerName?: string | null;
  isOfflineQueued?: boolean;
  payments?: Array<{
    method: string;
    amount: number;
    reference?: string | null;
  }>;
}

interface ReceiptProps {
  data: ReceiptData;
  onNewSale: () => void;
  closeLabel?: string;
}

export default function Receipt({ data, onNewSale, closeLabel }: ReceiptProps) {
  const { businessName, businessNameMm, address, phone, logo, receiptFooter } = useSettingsStore();
  const { t } = useI18n();
  const [paperSize, setPaperSize] = useState<'80mm' | '58mm'>('80mm');

  const handlePrint = () => {
    document.body.setAttribute('data-print-size', paperSize);
    printElementById('receipt-content', {
      title: `${businessName} - ${data.invoiceNumber}`,
      paperSize,
    });
  };

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return t('cash');
      case 'CARD': return t('card');
      case 'MOBILE_BANKING': return t('mobileBanking');
      case 'CREDIT': return t('Credit', 'အကြွေး');
      case 'SPLIT': return t('Split Payment', 'ပေါင်းစပ်ပေးချေမှု');
      default: return method;
    }
  };

  return (
    <div className="modal-backdrop print-modal-backdrop" onClick={onNewSale}>
      <div
        className="modal print-modal"
        style={{ maxWidth: paperSize === '58mm' ? '300px' : '380px' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Thermal Paper Width Selector (hidden during print) */}
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: 'var(--space-sm) var(--space-md)',
            borderBottom: '1px solid var(--border-subtle)',
            background: 'var(--bg-secondary)',
          }}
        >
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <Printer size={13} strokeWidth={1.75} />
            {t('Paper Size', 'စက္ကူအရွယ်အစား')}:
          </span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button
              type="button"
              className={`btn btn-sm ${paperSize === '80mm' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPaperSize('80mm')}
              style={{ padding: '2px 8px', fontSize: 11 }}
            >
              80mm
            </button>
            <button
              type="button"
              className={`btn btn-sm ${paperSize === '58mm' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setPaperSize('58mm')}
              style={{ padding: '2px 8px', fontSize: 11 }}
            >
              58mm
            </button>
          </div>
        </div>

        <div
          className={`receipt-printable receipt-container receipt-${paperSize}`}
          style={{
            padding: 'var(--space-xl)',
            fontFamily: 'var(--font-mono)',
            fontSize: paperSize === '58mm' ? '11px' : 'var(--text-sm)',
          }}
          id="receipt-content"
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
            {logo && (
              <div style={{ marginBottom: 6 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo}
                  alt={businessName}
                  style={{ maxHeight: 48, maxWidth: 140, objectFit: 'contain', margin: '0 auto' }}
                />
              </div>
            )}
            <div
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 800,
                color: 'var(--text-primary)',
                marginBottom: '4px',
              }}
            >
              {businessName}
            </div>
            {businessNameMm && (
              <div
                className="mm-text"
                style={{
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-muted)',
                  marginBottom: '2px',
                }}
              >
                {businessNameMm}
              </div>
            )}
            {address && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {address}
              </div>
            )}
            {phone && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                Tel: {phone}
              </div>
            )}
            {data.isOfflineQueued && (
              <div className="badge badge-warning" style={{ marginTop: 4, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <WifiOff size={12} strokeWidth={1.75} />
                {t('Offline Receipt (Pending Sync)', 'အော့ဖ်လိုင်းဘောင်ချာ')}
              </div>
            )}
            <div
              style={{
                width: '100%',
                borderTop: '2px dashed var(--border-default)',
                margin: 'var(--space-sm) 0',
              }}
            />
          </div>

          {/* Invoice Info */}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('invoiceNumber')}:</span>
              <span style={{ fontWeight: 600 }}>{data.invoiceNumber}</span>
            </div>
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('date')}:</span>
              <span>{formatDateTime(data.createdAt)}</span>
            </div>
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('cashier')}:</span>
              <span>{data.cashierName}</span>
            </div>
            {data.customerName && (
              <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('customers')}:</span>
                <span>{data.customerName}</span>
              </div>
            )}
          </div>

          <div
            style={{
              width: '100%',
              borderTop: '1px dashed var(--border-default)',
              margin: 'var(--space-sm) 0',
            }}
          />

          {/* Line Items */}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            {data.items.map((item, index) => (
              <div key={index} style={{ marginBottom: 'var(--space-sm)' }}>
                <div style={{ fontWeight: 600, marginBottom: '2px' }}>{item.name}</div>
                <div className="flex justify-between" style={{ color: 'var(--text-secondary)' }}>
                  <span>
                    {formatQuantity(item.quantity)}{item.unit ? ` ${item.unit}` : ''} × {formatCurrency(item.unitPrice)}
                    {item.discount && item.discount > 0 ? ` (−${formatCurrency(item.discount)})` : ''}
                  </span>
                  <span>{formatCurrency(item.total)}</span>
                </div>
              </div>
            ))}
          </div>

          <div
            style={{
              width: '100%',
              borderTop: '1px dashed var(--border-default)',
              margin: 'var(--space-sm) 0',
            }}
          />

          {/* Totals */}
          <div style={{ marginBottom: 'var(--space-md)' }}>
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('subtotal')}</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discountAmount > 0 && (
              <div
                className="flex justify-between"
                style={{ marginBottom: '4px', color: 'var(--danger)' }}
              >
                <span>{t('discount')}</span>
                <span>−{formatCurrency(data.discountAmount)}</span>
              </div>
            )}
            {data.taxAmount > 0 && (
              <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>{t('tax')}</span>
                <span>{formatCurrency(data.taxAmount)}</span>
              </div>
            )}
            <div
              className="flex justify-between"
              style={{
                fontWeight: 800,
                fontSize: 'var(--text-lg)',
                color: 'var(--primary)',
                paddingTop: 'var(--space-sm)',
                borderTop: '2px solid var(--border-default)',
                marginTop: 'var(--space-sm)',
              }}
            >
              <span>{t('total').toUpperCase()}</span>
              <span>{formatCurrency(data.totalAmount)}</span>
            </div>
          </div>

          <div
            style={{
              width: '100%',
              borderTop: '1px dashed var(--border-default)',
              margin: 'var(--space-sm) 0',
            }}
          />

          {/* Payment Info */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('paymentMethod')}</span>
              <span>{getMethodLabel(data.paymentMethod)}</span>
            </div>
            {data.payments && data.payments.length > 1 && (
              <div style={{ marginBottom: 6, paddingLeft: 8, borderLeft: '2px solid var(--border-subtle)' }}>
                {data.payments.map((leg, i) => (
                  <div key={i} className="flex justify-between" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
                    <span>{getMethodLabel(leg.method)}{leg.reference ? ` (${leg.reference})` : ''}</span>
                    <span>{formatCurrency(leg.amount)}</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>{t('paidAmount')}</span>
              <span>{formatCurrency(data.paidAmount)}</span>
            </div>
            {(data.dueAmount ?? 0) > 0 && (
              <div
                className="flex justify-between"
                style={{ fontWeight: 700, color: 'var(--danger)', marginBottom: '4px' }}
              >
                <span>{t('Credit Due', 'ကြွေးကျန်')}</span>
                <span>{formatCurrency(data.dueAmount ?? 0)}</span>
              </div>
            )}
            {data.changeAmount > 0 && (
              <div
                className="flex justify-between"
                style={{ fontWeight: 700, color: 'var(--success)' }}
              >
                <span>{t('changeAmount')}</span>
                <span>{formatCurrency(data.changeAmount)}</span>
              </div>
            )}
            {((data.pointsEarned ?? 0) > 0 || (data.pointsRedeemed ?? 0) > 0) && (
              <div style={{ marginTop: 6, fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {(data.pointsRedeemed ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span>{t('Points Redeemed', 'သုံးခဲ့သောပွိုင့်')}:</span>
                    <span>−{data.pointsRedeemed} pts</span>
                  </div>
                )}
                {(data.pointsEarned ?? 0) > 0 && (
                  <div className="flex justify-between">
                    <span>{t('Points Earned', 'ရရှိသောပွိုင့်')}:</span>
                    <span>+{data.pointsEarned} pts</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              textAlign: 'center',
              color: 'var(--text-muted)',
              borderTop: '2px dashed var(--border-default)',
              paddingTop: 'var(--space-md)',
              whiteSpace: 'pre-wrap',
            }}
          >
            {receiptFooter ? (
              <div style={{ fontSize: 'var(--text-sm)' }}>
                {receiptFooter}
              </div>
            ) : (
              <>
                <div style={{ fontSize: 'var(--text-base)', marginBottom: '4px' }}>
                  Thank you!
                </div>
                <div className="mm-text" style={{ fontSize: 'var(--text-sm)' }}>
                  ကျေးဇူးတင်ပါသည်!
                </div>
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div
          className="modal-footer no-print"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <button
            className="btn btn-secondary"
            onClick={handlePrint}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} strokeWidth={1.75} />
            {t('print')} ({paperSize})
          </button>
          <button
            className="btn btn-primary"
            onClick={onNewSale}
            type="button"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {!closeLabel && <Plus size={15} strokeWidth={2} />}
            {closeLabel || t('New Sale', 'အရောင်းအသစ်')}
          </button>
        </div>
      </div>
    </div>
  );
}
