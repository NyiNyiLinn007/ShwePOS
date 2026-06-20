'use client';

import { useCartStore } from '@/store/cartStore';
import { useAppStore } from '@/lib/store';
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

const CATEGORY_EMOJIS: Record<string, string> = {
  food: '🍚',
  drinks: '🥤',
  beverages: '🥤',
  snacks: '🍿',
  grocery: '🛒',
  dairy: '🧀',
  bakery: '🍞',
  meat: '🥩',
  seafood: '🐟',
  vegetables: '🥬',
  fruits: '🍎',
  frozen: '🧊',
  household: '🏠',
  personal: '💄',
  beauty: '💅',
  health: '💊',
  electronics: '📱',
  stationery: '📝',
  clothing: '👕',
  tobacco: '🚬',
  alcohol: '🍺',
  default: '📦',
};

function getCategoryEmoji(categoryName: string): string {
  const key = categoryName.toLowerCase();
  for (const [keyword, emoji] of Object.entries(CATEGORY_EMOJIS)) {
    if (key.includes(keyword)) {
      return emoji;
    }
  }
  return CATEGORY_EMOJIS.default;
}

export default function ProductGrid({ products }: ProductGridProps) {
  const addItem = useCartStore((state) => state.addItem);
  const { language } = useAppStore();
  const t = (en: string, mm: string) => (language === 'mm' ? mm : en);

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
            style={
              isOutOfStock
                ? { opacity: 0.5, cursor: 'not-allowed', position: 'relative' }
                : { position: 'relative' }
            }
            type="button"
          >
            <div className="pos-product-img">
              {getCategoryEmoji(product.category.name)}
            </div>
            <div className="pos-product-name">{product.name}</div>
            <div className="pos-product-price">
              {formatCurrency(product.sellingPrice)}
            </div>
            <div
              className="pos-product-stock"
              style={
                product.stockQuantity <= 10 && product.stockQuantity > 0
                  ? { color: 'var(--warning)' }
                  : undefined
              }
            >
              {isOutOfStock
                ? t('Out of Stock', 'ကုန်ပစ္စည်းကုန်')
                : `${t('Stock', 'ကုန်လက်ကျန်')}: ${product.stockQuantity}`}
            </div>
            {isOutOfStock && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 'var(--radius-lg)',
                  background: 'rgba(0,0,0,0.5)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 'var(--text-xs)',
                  fontWeight: 700,
                  color: 'var(--danger)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {t('Out of Stock', '\u1000\u102f\u1014\u103a\u1015\u1005\u1039\u1005\u100a\u103a\u1038\u1000\u102f\u1014\u103a')}
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
