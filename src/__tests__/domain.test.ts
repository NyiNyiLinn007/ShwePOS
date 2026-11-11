import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateTax,
  formatCurrency,
  formatQuantity,
  getExpiryInfo,
  getMyanmarDateCompact,
  getMyanmarDateKey,
  getMyanmarHour,
  isFractionalUnit,
  parseMyanmarDateBoundary,
  roundQuantity,
} from '@/lib/utils';
import { summarizeShiftCash } from '@/lib/shiftUtils';
import { buildCode128Bars, encodeCode128BCodes } from '@/lib/barcode';
import { useCartStore } from '@/store/cartStore';

describe('Myanmar Timezone Standardization (Asia/Yangon, UTC+6:30)', () => {
  it('converts UTC late evening (18:00 UTC) to next day 00:30 in Myanmar time', () => {
    const utcDate = '2026-11-10T18:00:00.000Z';
    assert.equal(getMyanmarDateKey(utcDate), '2026-11-11');
    assert.equal(getMyanmarDateCompact(utcDate), '20261111');
    assert.equal(getMyanmarHour(utcDate), 0);
  });

  it('parses YYYY-MM-DD start and end boundaries in UTC+6:30', () => {
    const start = parseMyanmarDateBoundary('2026-11-11', false);
    const end = parseMyanmarDateBoundary('2026-11-11', true);
    assert.ok(start);
    assert.ok(end);
    // 2026-11-11 00:00:00.000 MMT === 2026-11-10 17:30:00.000 UTC
    assert.equal(start.toISOString(), '2026-11-10T17:30:00.000Z');
    assert.equal(end.toISOString(), '2026-11-11T17:29:59.999Z');
  });
});

describe('Currency, Fractional Quantity & Expiry Helpers', () => {
  it('formats Myanmar Kyat currency with comma separators', () => {
    assert.equal(formatCurrency(1500), 'K 1,500');
    assert.equal(formatCurrency(0), 'K 0');
  });

  it('identifies fractional units and rounds to 3 decimal places', () => {
    assert.equal(isFractionalUnit('kg'), true);
    assert.equal(isFractionalUnit('liter'), true);
    assert.equal(isFractionalUnit('pcs'), false);
    assert.equal(roundQuantity(0.1 + 0.2), 0.3);
    assert.equal(formatQuantity(1.25, 'kg'), '1.25');
    assert.equal(formatQuantity(5.0, 'pcs'), '5');
  });

  it('evaluates product expiry status accurately', () => {
    const past = new Date(Date.now() - 5 * 86400_000).toISOString();
    const soon = new Date(Date.now() + 10 * 86400_000).toISOString();
    const future = new Date(Date.now() + 90 * 86400_000).toISOString();

    assert.equal(getExpiryInfo(past)?.status, 'expired');
    assert.equal(getExpiryInfo(soon)?.status, 'expiring_soon');
    assert.equal(getExpiryInfo(future)?.status, 'valid');
    assert.equal(getExpiryInfo(null), null);
  });
});

describe('Shift Cash Drawer Accounting (summarizeShiftCash)', () => {
  it('computes expectedCash = openingCash + cashSales + paidIn - paidOut - refunds', () => {
    const summary = summarizeShiftCash(50000, [
      { type: 'CASH_SALE', amount: 12000 },
      { type: 'CASH_SALE', amount: 8000 },
      { type: 'PAID_IN', amount: 5000 },
      { type: 'PAID_OUT', amount: 3000 },
      { type: 'REFUND', amount: -2000 },
    ]);

    assert.equal(summary.cashSales, 20000);
    assert.equal(summary.paidIn, 5000);
    assert.equal(summary.paidOut, 3000);
    assert.equal(summary.refunds, 2000);
    // 50,000 + 20,000 + 5,000 - 3,000 - 2,000 = 70,000
    assert.equal(summary.expectedCash, 70000);
  });
});

describe('Code-128B Barcode Encoder', () => {
  it('encodes Start B (104), modulo-103 checksum, and Stop (106)', () => {
    const codes = encodeCode128BCodes('PRD-01');
    assert.equal(codes[0], 104);
    assert.equal(codes[codes.length - 1], 106);
    const bars = buildCode128Bars('PRD-01');
    assert.ok(bars.length > 10);
  });
});

describe('POS Cart Store Calculations & Hold/Resume Queue', () => {
  it('calculates subtotal, percentage/fixed discounts, tax, and held bills', () => {
    const store = useCartStore.getState();
    store.clearCart();

    store.addItem({
      id: 'p1',
      name: 'Rice 5kg',
      nameMm: 'ဆန် ၅ ကီလို',
      sku: 'RICE-01',
      barcode: null,
      categoryId: 'cat-1',
      sellingPrice: 10000,
      stockQuantity: 20,
      lowStockThreshold: 2,
      unit: 'kg',
      imageUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    // Update to fractional 1.5 kg => subtotal 15,000
    store.updateQuantity('p1', 1.5);
    assert.equal(useCartStore.getState().getSubtotal(), 15000);

    // 10% cart discount => 1,500 discount => 13,500 net
    store.setDiscountType('PERCENT');
    store.setDiscount(10);
    assert.equal(useCartStore.getState().getCartDiscountAmount(), 1500);
    const netTotal = useCartStore.getState().getTotal();
    assert.equal(netTotal, 13500);
    // With 5% tax on 13,500 => 675 tax => 14,175 total
    assert.equal(calculateTax(netTotal, 5), 675);

    // Hold and Resume bill
    const heldOk = useCartStore.getState().holdCurrentBill('Table 1');
    assert.equal(heldOk, true);
    assert.equal(useCartStore.getState().items.length, 0);
    assert.equal(useCartStore.getState().heldBills.length, 1);

    const heldId = useCartStore.getState().heldBills[0].id;
    useCartStore.getState().resumeHeldBill(heldId);
    assert.equal(useCartStore.getState().items.length, 1);
    assert.equal(useCartStore.getState().items[0].quantity, 1.5);
    store.clearCart();
  });
});
