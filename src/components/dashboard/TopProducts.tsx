'use client';

import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { BarChart3 } from '@/components/ui/Icons';

interface TopProductItem {
  productId: string;
  productName: string;
  totalQuantity: number;
  totalRevenue: number;
}

interface TopProductsProps {
  products: TopProductItem[];
}

export default function TopProducts({ products }: TopProductsProps) {
  const { t } = useI18n();
  const maxRevenue = products.length > 0 ? Math.max(...products.map((p) => p.totalRevenue)) : 1;

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: '14px var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <h3 style={{ fontSize: 'var(--text-base)', fontWeight: 600 }}>
          {t('Top Products', 'ထိပ်တန်းပစ္စည်းများ')}
        </h3>
      </div>

      {products.length === 0 ? (
        <div className="empty-state" style={{ border: 'none', borderRadius: 0 }}>
          <div className="empty-state-icon">
            <BarChart3 size={20} strokeWidth={1.75} />
          </div>
          <div className="empty-state-title">
            {t('No product data', 'ပစ္စည်းအချက်အလက်မရှိပါ')}
          </div>
        </div>
      ) : (
        <div style={{ padding: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {products.map((product, index) => {
              const barWidthPercent = (product.totalRevenue / maxRevenue) * 100;

              return (
                <div key={product.productId} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--bg-secondary)',
                          border: '1px solid var(--border-subtle)',
                          color: 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '11px',
                          fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums',
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 500,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {product.productName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                      <span
                        style={{
                          fontSize: 'var(--text-xs)',
                          color: 'var(--text-muted)',
                        }}
                      >
                        {formatNumber(product.totalQuantity)} {t('sold', 'ရောင်း')}
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          minWidth: 85,
                          textAlign: 'right',
                        }}
                      >
                        {formatCurrency(product.totalRevenue)}
                      </span>
                    </div>
                  </div>
                  {/* Horizontal bar */}
                  <div
                    style={{
                      height: 5,
                      borderRadius: 'var(--radius-full)',
                      background: 'var(--bg-secondary)',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${barWidthPercent}%`,
                        borderRadius: 'var(--radius-full)',
                        background: 'var(--primary)',
                        transition: 'width 0.4s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
