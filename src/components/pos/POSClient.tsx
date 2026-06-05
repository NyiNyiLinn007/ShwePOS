'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cartStore';
import { useSettingsStore } from '@/store/settingsStore';
import ProductGrid from '@/components/pos/ProductGrid';
import Cart from '@/components/pos/Cart';
import PaymentModal from '@/components/pos/PaymentModal';
import Receipt from '@/components/pos/Receipt';

interface Category {
  id: string;
  name: string;
  nameMm: string | null;
  slug: string;
}

interface Product {
  id: string;
  name: string;
  nameMm: string | null;
  sellingPrice: number;
  costPrice: number;
  stockQuantity: number;
  sku: string;
  barcode: string | null;
  unit: string;
  imageUrl: string | null;
  category: {
    id: string;
    name: string;
    nameMm: string | null;
  };
}

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

interface POSClientProps {
  initialProducts: Product[];
  initialCategories: Category[];
  taxRate: number;
}

export default function POSClient({
  initialProducts,
  initialCategories,
  taxRate,
}: POSClientProps) {
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [searchQuery, setSearchQuery] = useState('');

  // Sync when server re-renders with fresh data (e.g., inventory adjustments)
  useEffect(() => { setProducts(initialProducts); }, [initialProducts]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const clearCart = useCartStore((s) => s.clearCart);

  // Full-screen mode: hide sidebar, remove main-content margin
  useEffect(() => {
    document.body.classList.add('pos-fullscreen');
    return () => {
      document.body.classList.remove('pos-fullscreen');
    };
  }, []);

  // Filter products by search + category + hide out-of-stock
  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      // Hide out-of-stock products
      if (product.stockQuantity <= 0) return false;

      const matchesSearch =
        searchQuery === '' ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.nameMm && product.nameMm.includes(searchQuery)) ||
        product.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (product.barcode &&
          product.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCategory =
        selectedCategory === null ||
        product.category.id === selectedCategory;

      return matchesSearch && matchesCategory;
    });
  }, [products, searchQuery, selectedCategory]);

  // Keyboard shortcuts
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'F2') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'F9') {
        e.preventDefault();
        const items = useCartStore.getState().items;
        if (items.length > 0) {
          setShowPayment(true);
        }
      }
      if (e.key === 'Escape') {
        if (showPayment) {
          setShowPayment(false);
        } else if (receiptData) {
          handleNewSale();
        }
      }
    },
    [showPayment, receiptData]
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  const handlePaymentSuccess = (saleData: {
    invoiceNumber: string;
    createdAt: string;
    subtotal: number;
    discountAmount: number;
    taxAmount: number;
    totalAmount: number;
    paidAmount: number;
    changeAmount: number;
    paymentMethod: string;
    items: Array<{
      quantity: number;
      unitPrice: number;
      total: number;
      product: { name: string; id?: string };
      productId?: string;
    }>;
    customer: { name: string } | null;
    user: { name: string };
  }) => {
    setShowPayment(false);
    setReceiptData({
      invoiceNumber: saleData.invoiceNumber,
      createdAt: saleData.createdAt,
      cashierName: saleData.user.name,
      items: saleData.items.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        total: item.total,
      })),
      subtotal: saleData.subtotal,
      discountAmount: saleData.discountAmount,
      taxAmount: saleData.taxAmount,
      totalAmount: saleData.totalAmount,
      paymentMethod: saleData.paymentMethod,
      paidAmount: saleData.paidAmount,
      changeAmount: saleData.changeAmount,
      customerName: saleData.customer?.name || null,
    });

    // Update stock counts locally after sale
    const soldItems = useCartStore.getState().items;
    setProducts((prev) =>
      prev.map((product) => {
        const soldItem = soldItems.find((si) => si.productId === product.id);
        if (soldItem) {
          return {
            ...product,
            stockQuantity: Math.max(0, product.stockQuantity - soldItem.quantity),
          };
        }
        return product;
      })
    );

    clearCart();
  };

  const handleNewSale = () => {
    setReceiptData(null);
    setSearchQuery('');
    setSelectedCategory(null);
  };

  return (
    <div className="pos-layout" style={{ marginLeft: 0 }}>
      {/* LEFT: Products Area */}
      <div className="pos-products">
        {/* Search Header */}
        <div className="pos-products-header">
          <button
            onClick={() => router.push('/')}
            title="Exit POS"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              flex: '0 0 auto',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)',
              padding: '6px 12px',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              fontSize: 'var(--text-sm)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--primary)';
              e.currentTarget.style.color = '#fff';
              e.currentTarget.style.borderColor = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--bg-tertiary)';
              e.currentTarget.style.color = 'var(--text-secondary)';
              e.currentTarget.style.borderColor = 'var(--border-default)';
            }}
          >
            <span style={{ fontSize: '16px' }}>←</span>
            <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{useSettingsStore.getState().businessName}</span>
          </button>
          <input
            ref={searchRef}
            type="text"
            className="input input-search"
            placeholder="Search products... (F2)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1 }}
          />
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 'var(--space-xs)',
              fontSize: 'var(--text-xs)',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
            }}
          >
            <span className="badge badge-neutral">F9 Pay</span>
          </div>
        </div>

        {/* Category Filters */}
        <div className="pos-categories">
          <button
            className={`pos-category-btn ${selectedCategory === null ? 'active' : ''}`}
            onClick={() => setSelectedCategory(null)}
            type="button"
          >
            All
          </button>
          {initialCategories.map((cat) => (
            <button
              key={cat.id}
              className={`pos-category-btn ${
                selectedCategory === cat.id ? 'active' : ''
              }`}
              onClick={() =>
                setSelectedCategory(
                  selectedCategory === cat.id ? null : cat.id
                )
              }
              type="button"
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <ProductGrid products={filteredProducts} />
      </div>

      {/* RIGHT: Cart Panel */}
      <Cart onOpenPayment={() => setShowPayment(true)} taxRate={taxRate} />

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          onClose={() => setShowPayment(false)}
          onSuccess={handlePaymentSuccess}
          taxRate={taxRate}
        />
      )}

      {/* Receipt */}
      {receiptData && (
        <Receipt data={receiptData} onNewSale={handleNewSale} />
      )}
    </div>
  );
}
