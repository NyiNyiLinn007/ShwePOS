'use client';

import React, { useEffect, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import {
  readCustomerDisplaySnapshot,
  subscribeCustomerDisplay,
  type CustomerDisplayPayload,
} from '@/lib/customerDisplayChannel';
import { CheckCircle2, QrCode, ShoppingCart, Sparkles } from '@/components/ui/Icons';

interface CustomerDisplayClientProps {
  defaultBusinessName: string;
  defaultBusinessNameMm: string | null;
  defaultLogo: string | null;
  defaultReceiptFooter: string | null;
}

export function CustomerDisplayClient({
  defaultBusinessName,
  defaultBusinessNameMm,
  defaultLogo,
  defaultReceiptFooter,
}: CustomerDisplayClientProps) {
  const { language, t } = useI18n();
  const [state, setState] = useState<CustomerDisplayPayload | null>(null);

  useEffect(() => {
    setState(readCustomerDisplaySnapshot());
    return subscribeCustomerDisplay((next) => setState(next));
  }, []);

  const businessName = state?.businessName || defaultBusinessName || 'ShwePOS';
  const businessNameMm = state?.businessNameMm ?? defaultBusinessNameMm;
  const logo = state?.logo ?? defaultLogo;

  const mode = state?.mode ?? 'IDLE';

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bg-primary)',
        color: 'var(--text-primary)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'clamp(16px, 3vw, 32px)',
      }}
    >
      {/* Top Store Banner */}
      <header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingBottom: 'var(--space-md)',
          borderBottom: '1px solid var(--border-color)',
          marginBottom: 'var(--space-lg)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logo}
              alt={businessName}
              style={{
                width: 48,
                height: 48,
                objectFit: 'contain',
                borderRadius: 8,
                background: '#fff',
                padding: 4,
                border: '1px solid var(--border-color)',
              }}
            />
          ) : (
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 10,
                background: 'var(--primary)',
                color: '#fff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                fontSize: 22,
              }}
            >
              {businessName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <div style={{ fontSize: 'clamp(20px, 2.4vw, 28px)', fontWeight: 800, lineHeight: 1.15 }}>
              {language === 'mm' && businessNameMm ? businessNameMm : businessName}
            </div>
            {businessNameMm && language !== 'mm' && (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}>
                {businessNameMm}
              </div>
            )}
          </div>
        </div>
        <span className="badge badge-primary" style={{ fontSize: 'var(--text-xs)' }}>
          {t('Customer Display', 'ဖောက်သည် မျက်နှာပြင်')}
        </span>
      </header>

      {/* Main Content by Mode */}
      {mode === 'IDLE' && (
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 16,
          }}
        >
          <div
            style={{
              width: 88,
              height: 88,
              borderRadius: '50%',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--primary)',
            }}
          >
            <ShoppingCart size={40} strokeWidth={1.5} />
          </div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 44px)', fontWeight: 800, margin: 0 }}>
            {t('Welcome!', 'မင်္ဂလာပါ — ကြိုဆိုပါသည်')}
          </h1>
          <p style={{ fontSize: 'var(--text-lg)', color: 'var(--text-muted)', maxWidth: 540 }}>
            {defaultReceiptFooter ||
              t(
                'Your scanned items and total will appear here automatically.',
                'သင့်ဝယ်ယူသည့်ပစ္စည်းများနှင့် စုစုပေါင်းကျသင့်ငွေကို ဤနေရာတွင် အလိုအလျောက် ပြသပေးပါမည်။'
              )}
          </p>
        </main>
      )}

      {mode === 'COMPLETED' && state && (
        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            textAlign: 'center',
            gap: 18,
          }}
        >
          <CheckCircle2 size={72} strokeWidth={1.5} style={{ color: 'var(--success)' }} />
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: 800, margin: 0 }}>
            {t('Thank You For Shopping!', 'ဝယ်ယူအားပေးမှုအတွက် ကျေးဇူးတင်ပါသည်')}
          </h1>
          {state.invoiceNumber && (
            <div style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
              {state.invoiceNumber}
            </div>
          )}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 16,
              width: 'min(90vw, 640px)',
              marginTop: 8,
            }}
          >
            <div className="kpi-card" style={{ textAlign: 'center' }}>
              <div className="kpi-label">{t('Total Paid', 'ပေးချေငွေ')}</div>
              <div className="kpi-value" style={{ fontSize: 28 }}>
                {formatCurrency(state.paidAmount ?? state.grandTotal)}
              </div>
            </div>
            {(state.changeAmount ?? 0) > 0 && (
              <div className="kpi-card" style={{ textAlign: 'center', borderColor: 'var(--success)' }}>
                <div className="kpi-label">{t('Change Due', 'ပြန်အမ်းငွေ')}</div>
                <div className="kpi-value" style={{ fontSize: 32, color: 'var(--success)' }}>
                  {formatCurrency(state.changeAmount ?? 0)}
                </div>
              </div>
            )}
          </div>
        </main>
      )}

      {(mode === 'CART' || mode === 'PAYMENT_QR') && state && (
        <main
          style={{
            flex: 1,
            display: 'grid',
            gridTemplateColumns: mode === 'PAYMENT_QR' && state.qrUrl ? '1.1fr 0.9fr' : '1.4fr 0.8fr',
            gap: 'var(--space-xl)',
            alignItems: 'stretch',
          }}
        >
          {/* Left: Scanned Items List */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-lg)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 700,
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-md)',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{t('Your Items', 'ဝယ်ယူသည့်ပစ္စည်းစာရင်း')}</span>
              <span>
                {state.items.length} {t('line(s)', 'မျိုး')}
              </span>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {state.items.map((item, idx) => (
                <div
                  key={`${item.name}-${idx}`}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '10px 12px',
                    background: 'var(--bg-primary)',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                  }}
                >
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
                      {language === 'mm' && item.nameMm ? item.nameMm : item.name}
                    </div>
                    <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {formatCurrency(item.unitPrice)} × {formatQuantity(item.quantity, item.unit)} {item.unit}
                    </div>
                  </div>
                  <div
                    style={{
                      fontWeight: 800,
                      fontSize: 'var(--text-lg)',
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {formatCurrency(item.lineTotal)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: Totals OR Big Mobile Banking QR Scan Card */}
          <div
            style={{
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-lg)',
              padding: 'var(--space-xl)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 'var(--space-lg)',
            }}
          >
            {mode === 'PAYMENT_QR' && state.qrUrl ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  textAlign: 'center',
                  gap: 14,
                }}
              >
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 'var(--text-lg)',
                    fontWeight: 800,
                    color: 'var(--primary)',
                  }}
                >
                  <QrCode size={22} strokeWidth={2} />
                  {state.qrLabel || 'KBZPay / WavePay'}
                </div>
                <div
                  style={{
                    padding: 16,
                    background: '#ffffff',
                    borderRadius: 'var(--radius-lg)',
                    border: '2px solid var(--primary)',
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={state.qrUrl}
                    alt={state.qrLabel || 'Mobile Banking QR'}
                    style={{ width: 'min(42vw, 320px)', height: 'min(42vw, 320px)', objectFit: 'contain', display: 'block' }}
                  />
                </div>
                <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
                  {t('Please scan QR and transfer exact amount', 'QR Scan ဖတ်၍ အောက်ပါပမာဏအတိအကျ လွှဲပေးပါ')}
                </div>
                <div
                  style={{
                    fontSize: 'clamp(28px, 3.6vw, 44px)',
                    fontWeight: 900,
                    fontFamily: 'var(--font-mono)',
                    fontVariantNumeric: 'tabular-nums',
                    color: 'var(--primary)',
                  }}
                >
                  {formatCurrency(state.qrPayableAmount ?? state.grandTotal)}
                </div>
              </div>
            ) : (
              <>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-lg)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>{t('subtotal')}</span>
                    <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(state.subtotal)}</span>
                  </div>
                  {state.discountAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-lg)', color: 'var(--success)' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <Sparkles size={16} />
                        {state.promoLabel || t('discount')}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>
                        −{formatCurrency(state.discountAmount)}
                      </span>
                    </div>
                  )}
                  {state.taxAmount > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 'var(--text-lg)' }}>
                      <span style={{ color: 'var(--text-muted)' }}>{t('Tax', 'အခွန်')}</span>
                      <span style={{ fontFamily: 'var(--font-mono)' }}>{formatCurrency(state.taxAmount)}</span>
                    </div>
                  )}
                </div>

                <div
                  style={{
                    paddingTop: 'var(--space-lg)',
                    borderTop: '2px solid var(--border-color)',
                    textAlign: 'right',
                  }}
                >
                  <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-muted)', marginBottom: 4 }}>
                    {t('Total Payable', 'စုစုပေါင်း ကျသင့်ငွေ')}
                  </div>
                  <div
                    style={{
                      fontSize: 'clamp(36px, 4.5vw, 56px)',
                      fontWeight: 900,
                      color: 'var(--primary)',
                      fontFamily: 'var(--font-mono)',
                      fontVariantNumeric: 'tabular-nums',
                      lineHeight: 1.1,
                    }}
                  >
                    {formatCurrency(state.grandTotal)}
                  </div>
                </div>
              </>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
