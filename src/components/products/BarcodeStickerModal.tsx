'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency } from '@/lib/utils';
import { buildCode128Bars } from '@/lib/barcode';
import { printElementById } from '@/lib/print';
import { Barcode, Printer, X } from '@/components/ui/Icons';

export interface BarcodeProductTarget {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  barcode: string | null;
  sellingPrice: number;
}

interface BarcodeStickerModalProps {
  product: BarcodeProductTarget | null;
  onClose: () => void;
}

export function BarcodeStickerModal({ product, onClose }: BarcodeStickerModalProps) {
  const { language, t } = useI18n();
  const businessName = useSettingsStore((s) => s.businessName);
  const [labelCount, setLabelCount] = useState(4);

  if (!product) return null;

  return (
    <div className="modal-backdrop print-modal-backdrop" onClick={onClose}>
      <div
        className="modal modal-lg print-modal"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 640 }}
      >
        <div className="modal-header no-print">
          <h2 className="modal-title" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Barcode size={18} strokeWidth={1.75} />
            {t('Print Barcode Labels', 'ဘားကုဒ်စတစ်ကာ ထုတ်ရန်')} — {product.name}
          </h2>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>
            <X size={16} strokeWidth={1.75} />
          </button>
        </div>
        <div className="modal-body">
          <div className="flex gap-md no-print" style={{ marginBottom: 'var(--space-md)', alignItems: 'center' }}>
            <label className="input-label" style={{ margin: 0 }}>
              {t('Number of Stickers:', 'ထုတ်မည့် စတစ်ကာအရေအတွက် -')}
            </label>
            {[1, 2, 4, 8, 12, 24].map((cnt) => (
              <button
                key={cnt}
                type="button"
                className={`btn btn-sm ${labelCount === cnt ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setLabelCount(cnt)}
              >
                {cnt}
              </button>
            ))}
          </div>

          <div id="barcode-labels-content">
            <div
              className="barcode-print-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
                gap: '12px',
                padding: '12px',
                background: '#fff',
                color: '#000',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-color)',
              }}
            >
              {Array.from({ length: labelCount }).map((_, idx) => {
                const codeVal = product.barcode || product.sku;
                const bars = buildCode128Bars(codeVal);
                const totalWidth =
                  bars.length > 0 ? bars[bars.length - 1].x + bars[bars.length - 1].w + 10 : 120;
                return (
                  <div
                    key={idx}
                    className="barcode-sticker"
                    style={{
                      border: '1px dashed #ccc',
                      borderRadius: '4px',
                      padding: '8px',
                      textAlign: 'center',
                      background: '#fff',
                      color: '#000',
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      {businessName || 'ShwePOS'}
                    </div>
                    <div
                      style={{
                        fontSize: '11px',
                        fontWeight: 600,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        marginBottom: 4,
                      }}
                    >
                      {language === 'mm' && product.nameMm ? product.nameMm : product.name}
                    </div>
                    <svg
                      viewBox={`0 0 ${totalWidth} 42`}
                      style={{ width: '100%', height: '42px', display: 'block', margin: '0 auto' }}
                    >
                      {bars.map((b, bIdx) => (
                        <rect key={bIdx} x={b.x} y={2} width={b.w} height={38} fill="#000" />
                      ))}
                    </svg>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px', marginTop: 2 }}>
                      {codeVal}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, marginTop: 2 }}>
                      {formatCurrency(product.sellingPrice)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
        <div className="modal-footer no-print">
          <button className="btn btn-secondary" onClick={onClose}>
            {t('Close', 'ပိတ်ရန်')}
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              printElementById('barcode-labels-content', {
                title: `${product.name} - Barcode Labels`,
                paperSize: 'A4',
              })
            }
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Printer size={15} strokeWidth={1.75} />
            {t('Print Labels', 'စတစ်ကာ ပရင့်ထုတ်ရန်')}
          </button>
        </div>
      </div>
    </div>
  );
}
