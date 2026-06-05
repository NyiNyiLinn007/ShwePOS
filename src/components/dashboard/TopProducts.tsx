'use client';

import { useSettingsStore } from '@/stores/settingsStore';
import { formatCurrency, formatNumber } from '@/lib/utils';

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
  const { t } = useSettingsStore();
  const maxRevenue = products.length > 0 ? Math.max(...products.map((p) => p.totalRevenue)) : 1;

  return (
    <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          padding: 'var(--space-lg)',
          borderBottom: '1px solid var(--border-subtle)',
        }}
      >
        <h3 className="heading-4">
          {t('Top Products', 'ထိပ်တန်းပစ္စည်းများ')}
        </h3>
      </div>

      {products.length === 0 ? (
        <div className="empty-state" style={{ padding: 'var(--space-2xl)' }}>
          <div className="empty-state-icon">📊</div>
          <div className="empty-state-title">
            {t('No product data', 'ပစ္စည်းအချက်အလက်မရှိပါ')}
          </div>
        </div>
      ) : (
        <div style={{ padding: 'var(--space-lg)' }}>
          <div className="flex-col gap-md" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
            {products.map((product, index) => {
              const barWidthPercent = (product.totalRevenue / maxRevenue) * 100;

              return (
                <div key={product.productId} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
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
                          width: 24,
                          height: 24,
                          borderRadius: 'var(--radius-sm)',
                          background: 'var(--primary-light)',
                          color: 'var(--primary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 'var(--text-xs)',
                          fontWeight: 700,
                          flexShrink: 0,
                        }}
                      >
                        {index + 1}
                      </span>
                      <span
                        style={{
                          fontSize: 'var(--text-sm)',
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                        }}
                      >
                        {product.productName}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexShrink: 0 }}>
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
                          fontWeight: 700,
                          color: 'var(--primary)',
                          minWidth: 80,
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
                      height: 6,
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
                        background: 'linear-gradient(90deg, var(--primary-dark), var(--primary), var(--primary-hover))',
                        transition: 'width 0.6s ease',
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
