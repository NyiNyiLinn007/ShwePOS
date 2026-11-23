'use client';

import React, { useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { useSettingsStore } from '@/store/settingsStore';
import { formatCurrency } from '@/lib/utils';
import { buildCode128Bars } from '@/lib/barcode';
import { printElementById } from '@/lib/print';
import { Barcode, Layers, Printer, X } from '@/components/ui/Icons';
import type { ProductUnit } from '@/types';

export interface BarcodeProductTarget {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  barcode: string | null;
  sellingPrice: number;
  unit?: string;
  productUnits?: ProductUnit[];
}

interface BarcodeStickerModalProps {
  product: BarcodeProductTarget | null;
  onClose: () => void;
}

export function BarcodeStickerModal({ product, onClose }: BarcodeStickerModalProps) {
  const { language, t } = useI18n();
  const businessName = useSettingsStore((s) => s.businessName);
  const [labelCount, setLabelCount] = useState(4);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');

  if (!product) return null;

  const altUnits = product.productUnits ?? [];
  const activeUnit = altUnits.find((u) => u.id === selectedUnitId) ?? null;
  const activeCodeVal = activeUnit
    ? activeUnit.barcode || product.barcode || product.sku
    : product.barcode || product.sku;
  const activePrice = activeUnit ? activeUnit.sellingPrice : product.sellingPrice;
  const activeUnitLabel = activeUnit
    ? language === 'mm' && activeUnit.nameMm
      ? `${activeUnit.unitName} (${activeUnit.nameMm})`
      : activeUnit.unitName
    : product.unit || '';

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
          {altUnits.length > 0 && (
            <div
              className="flex gap-xs no-print"
              style={{
                marginBottom: 'var(--space-md)',
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              <label
                className="input-label"
                style={{ margin: 0, display: 'inline-flex', alignItems: 'center', gap: 4 }}
              >
                <Layers size={14} strokeWidth={1.75} />
                {t('Packaging Unit:', 'ထုပ်ပိုးမှုယူနစ် -')}
              </label>
              <button
                type="button"
                className={`btn btn-sm ${!activeUnit ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setSelectedUnitId('')}
              >
                {product.unit || t('Base Unit', 'အခြေခံယူနစ်')} ({formatCurrency(product.sellingPrice)})
              </button>
              {altUnits.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  className={`btn btn-sm ${activeUnit?.id === u.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => setSelectedUnitId(u.id)}
                >
                  {u.unitName} ×{u.conversionFactor} ({formatCurrency(u.sellingPrice)})
                </button>
              ))}
            </div>
          )}

          {activeUnit && !activeUnit.barcode && (
            <div
              className="no-print"
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--warning)',
                marginBottom: 'var(--space-sm)',
              }}
            >
              {t(
                'This alternate unit has no dedicated barcode yet; falling back to the base product barcode/SKU.',
                'ဤယူနစ်အတွက် သီးသန့်ဘားကုဒ် မထည့်ရသေးပါ — မူလကုန်ပစ္စည်း ဘားကုဒ်/SKU ကို အသုံးပြုထားပါသည်။'
              )}
            </div>
          )}

          <div className="flex gap-md no-print" style={{ marginBottom: 'var(--space-md)', alignItems: 'center', flexWrap: 'wrap' }}>
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
                const bars = buildCode128Bars(activeCodeVal);
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
                        marginBottom: activeUnit ? 1 : 4,
                      }}
                    >
                      {language === 'mm' && product.nameMm ? product.nameMm : product.name}
                    </div>
                    {activeUnit && (
                      <div style={{ fontSize: '9.5px', fontWeight: 600, color: '#333', marginBottom: 3 }}>
                        {activeUnitLabel} (×{activeUnit.conversionFactor})
                      </div>
                    )}
                    <svg
                      viewBox={`0 0 ${totalWidth} 42`}
                      style={{ width: '100%', height: '42px', display: 'block', margin: '0 auto' }}
                    >
                      {bars.map((b, bIdx) => (
                        <rect key={bIdx} x={b.x} y={2} width={b.w} height={38} fill="#000" />
                      ))}
                    </svg>
                    <div style={{ fontSize: '10px', fontFamily: 'monospace', letterSpacing: '1px', marginTop: 2 }}>
                      {activeCodeVal}
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 800, marginTop: 2 }}>
                      {formatCurrency(activePrice)}
                      {activeUnitLabel ? (
                        <span style={{ fontSize: '10px', fontWeight: 600 }}> / {activeUnit ? activeUnit.unitName : product.unit}</span>
                      ) : null}
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
                title: `${product.name}${activeUnit ? ` (${activeUnit.unitName})` : ''} - Barcode Labels`,
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
