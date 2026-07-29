'use client';

import { useCartStore } from '@/store/cartStore';
import { useI18n } from '@/lib/i18n';
import { formatCurrency } from '@/lib/utils';
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

function getCategoryInitial(categoryName: string): string {
  return categoryName.trim().slice(0, 1).toUpperCase() || 'P';
}

export default function ProductGrid({ products }: ProductGridProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { language, t } = useI18n();

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
        <div className="empty-state-icon">🔍</div>
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

        return (
          <button
            key={product.id}
            className="pos-product-card"
            onClick={() => handleAddToCart(product)}
            disabled={isOutOfStock}
            type="button"
          >
            <div className="pos-product-img">
              {getCategoryInitial(product.category.name)}
            </div>
            <div className="pos-product-name">{product.name}</div>
            <div className="pos-product-price">
              {formatCurrency(product.sellingPrice)}
            </div>
            <div className={`pos-product-stock${product.stockQuantity <= 10 && product.stockQuantity > 0 ? ' low' : ''}`}>
              {isOutOfStock
                ? t('outOfStock')
                : `${t('stock')}: ${product.stockQuantity}`}
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
