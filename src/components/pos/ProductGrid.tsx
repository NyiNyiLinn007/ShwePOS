'use client';

import { useCartStore } from '@/store/cartStore';
import { useI18n } from '@/lib/i18n';
import { formatCurrency, formatQuantity } from '@/lib/utils';
import { ProductMonogram, Search } from '@/components/ui/Icons';
import type { Product } from '@/types';

interface ProductForGrid {
  id: string;
  name: string;
  nameMm: string | null;
  sku: string;
  barcode: string | null;
  sellingPrice: number;
  costPrice?: number;
  stockQuantity: number;
  unit: string;
  imageUrl: string | null;
  category: {
    id: string;
    name: string;
    nameMm: string | null;
  };
}

interface ProductGridProps {
  products: ProductForGrid[];
}

export default function ProductGrid({ products }: ProductGridProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { t } = useI18n();

  const handleAddToCart = (product: ProductForGrid) => {
    if (product.stockQuantity <= 0) return;

    // Convert to Product type expected by the cart store
    const cartProduct: Product = {
      id: product.id,
      name: product.name,
      nameMm: product.nameMm,
      sku: product.sku,
      barcode: product.barcode,
      categoryId: product.category.id,
      costPrice: product.costPrice ?? 0,
      sellingPrice: product.sellingPrice,
      stockQuantity: product.stockQuantity,
      lowStockThreshold: 10,
      unit: product.unit,
      imageUrl: product.imageUrl,
      isActive: true,
      createdAt: '',
      updatedAt: '',
    };

    addItem(cartProduct);
  };

  if (products.length === 0) {
    return (
      <div className="empty-state" style={{ height: '100%' }}>
        <div className="empty-state-icon">
          <Search size={28} strokeWidth={1.5} />
        </div>
        <div className="empty-state-title">{t('No products found', 'ကုန်ပစ္စည်းမတွေ့ပါ')}</div>
        <div className="empty-state-text">
          {t('Try adjusting your search or category filter', 'ရှာဖွေမှု သို့မဟုတ် အမျိုးအစားစစ်ထုတ်မှုကို ပြန်ပြင်ကြည့်ပါ')}
        </div>
      </div>
    );
  }

  return (
    <div className="pos-product-grid">
      {products.map((product) => {
        const isOutOfStock = product.stockQuantity <= 0;
        const isLowStock = product.stockQuantity <= 10 && product.stockQuantity > 0;

        return (
          <button
            key={product.id}
            className="pos-product-card"
            onClick={() => handleAddToCart(product)}
            disabled={isOutOfStock}
            type="button"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                justifyContent: 'space-between',
                width: '100%',
                marginBottom: 'var(--space-xs)',
              }}
            >
              {product.imageUrl ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-sm)',
                    objectFit: 'cover',
                    border: '1px solid var(--border-subtle)',
                  }}
                />
              ) : (
                <ProductMonogram name={product.name} size={40} />
              )}
              <span
                className={`pos-product-stock${isLowStock ? ' low' : ''}`}
                style={{
                  fontSize: '11px',
                  padding: '2px 6px',
                  borderRadius: 'var(--radius-sm)',
                  background: isOutOfStock
                    ? 'var(--danger-light)'
                    : isLowStock
                      ? 'var(--warning-light)'
                      : 'var(--bg-tertiary)',
                  color: isOutOfStock
                    ? 'var(--danger)'
                    : isLowStock
                      ? 'var(--warning)'
                      : 'var(--text-secondary)',
                  fontWeight: 600,
                }}
              >
                {isOutOfStock
                  ? t('outOfStock')
                  : `${formatQuantity(product.stockQuantity)} ${product.unit}`}
              </span>
            </div>
            <div className="pos-product-name" style={{ textAlign: 'left', width: '100%' }}>
              {product.name}
            </div>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                width: '100%',
                marginTop: 'auto',
                paddingTop: 'var(--space-xs)',
              }}
            >
              <div className="pos-product-price">{formatCurrency(product.sellingPrice)}</div>
              <span
                style={{
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {product.sku}
              </span>
            </div>
            {isOutOfStock && (
              <div className="pos-product-unavailable">
                {t('outOfStock')}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
