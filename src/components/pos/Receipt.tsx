'use client';

import { formatCurrency, formatDateTime } from '@/lib/utils';
import { useSettingsStore } from '@/store/settingsStore';

interface ReceiptData {
  invoiceNumber: string;
  createdAt: string;
  cashierName: string;
  items: Array<{
    name: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  totalAmount: number;
  paymentMethod: string;
  paidAmount: number;
  changeAmount: number;
  customerName?: string | null;
}

interface ReceiptProps {
  data: ReceiptData;
  onNewSale: () => void;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: 'Cash',
  CARD: 'Card',
  MOBILE_BANKING: 'Mobile Banking',
};

export default function Receipt({ data, onNewSale }: ReceiptProps) {
  const { businessName, businessNameMm, address, phone, receiptFooter } = useSettingsStore();

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onNewSale}>
      <div
        className="modal"
        style={{ maxWidth: '380px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: 'var(--space-xl)',
            fontFamily: 'var(--font-mono)',
            fontSize: 'var(--text-sm)',
          }}
          id="receipt-content"
        >
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
            <div
              style={{
                fontSize: 'var(--text-xl)',
                fontWeight: 800,
                color: 'var(--primary)',
                marginBottom: '4px',
              }}
            >
              ✦ {businessName} ✦
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
              <span style={{ color: 'var(--text-muted)' }}>Invoice:</span>
              <span style={{ fontWeight: 600 }}>{data.invoiceNumber}</span>
            </div>
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Date:</span>
              <span>{formatDateTime(data.createdAt)}</span>
            </div>
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Cashier:</span>
              <span>{data.cashierName}</span>
            </div>
            {data.customerName && (
              <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Customer:</span>
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
                    {item.quantity} × {formatCurrency(item.unitPrice)}
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
              <span style={{ color: 'var(--text-muted)' }}>Subtotal</span>
              <span>{formatCurrency(data.subtotal)}</span>
            </div>
            {data.discountAmount > 0 && (
              <div
                className="flex justify-between"
                style={{ marginBottom: '4px', color: 'var(--danger)' }}
              >
                <span>Discount</span>
                <span>−{formatCurrency(data.discountAmount)}</span>
              </div>
            )}
            {data.taxAmount > 0 && (
              <div className="flex justify-between" style={{ marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Tax</span>
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
              <span>TOTAL</span>
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
              <span style={{ color: 'var(--text-muted)' }}>Payment</span>
              <span>{PAYMENT_LABELS[data.paymentMethod] || data.paymentMethod}</span>
            </div>
            <div className="flex justify-between" style={{ marginBottom: '4px' }}>
              <span style={{ color: 'var(--text-muted)' }}>Paid</span>
              <span>{formatCurrency(data.paidAmount)}</span>
            </div>
            {data.changeAmount > 0 && (
              <div
                className="flex justify-between"
                style={{ fontWeight: 700, color: 'var(--success)' }}
              >
                <span>Change</span>
                <span>{formatCurrency(data.changeAmount)}</span>
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
                  Thank you! 🙏
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
          className="modal-footer"
          style={{ borderTop: '1px solid var(--border-subtle)' }}
        >
          <button className="btn btn-secondary" onClick={handlePrint} type="button">
            🖨️ Print
          </button>
          <button className="btn btn-primary" onClick={onNewSale} type="button">
            ✨ New Sale
          </button>
        </div>
      </div>
    </div>
  );
}
