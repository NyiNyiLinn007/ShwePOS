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
import { getCartLineKey, useCartStore } from '@/store/cartStore';
import {
  DATA_MIGRATION_SHEETS,
  createDataMigrationWorkbook,
  parseDataMigrationWorkbook,
  validateXlsxContainer,
  workbookBuffer,
} from '@/lib/dataMigration';
import { MEDIA_OMITTED_MARKER } from '@/lib/dataMigrationWorkbook';
import {
  evaluateBestPromotion,
  type EvaluablePromotion,
  type PromoCartLine,
} from '@/lib/promotionEngine';
import { calculateMyanmarAgeDays, getAgingBucketKey } from '@/services/agingService';
import { calculateLineAmounts, calculateOrderTotals, roundMmk } from '@/lib/saleCalculator';
import { escapePrintHtml } from '@/lib/print';
import { escapeCsvCell } from '@/lib/csv';
import { isSafeImageUrl } from '@/lib/validations';
import writeXlsxFile from 'write-excel-file/node';

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

  it('supports custom unit price override and multi-unit wholesale packaging conversion', () => {
    const store = useCartStore.getState();
    store.clearCart();

    store.addItem({
      id: 'p2',
      name: 'Energy Drink',
      nameMm: null,
      sku: 'DRK-01',
      barcode: '8850001',
      categoryId: 'cat-1',
      costPrice: 700,
      sellingPrice: 1000,
      stockQuantity: 50,
      lowStockThreshold: 10,
      unit: 'pcs',
      imageUrl: null,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      productUnits: [
        {
          id: 'pu-carton',
          productId: 'p2',
          unitName: 'carton',
          nameMm: 'ဖာ',
          conversionFactor: 24,
          sellingPrice: 21500,
          barcode: '8850001-C24',
        },
      ],
    });

    // Switch to carton (24 pcs/carton => max 2 cartons from 50 base stock)
    useCartStore.getState().setItemUnit('p2', 'pu-carton');
    let item = useCartStore.getState().items[0];
    assert.equal(item.unit, 'carton');
    assert.equal(item.unitFactor, 24);
    assert.equal(item.unitPrice, 21500);

    // Try setting qty 5 cartons => clamped to 2 (50 / 24 = 2.08 -> floor 2)
    useCartStore.getState().updateQuantity('p2', 5);
    item = useCartStore.getState().items[0];
    assert.equal(item.quantity, 2);
    assert.equal(useCartStore.getState().getSubtotal(), 43000);

    // Override unit price to 20,000 K per carton => subtotal 40,000 K
    useCartStore.getState().updateUnitPrice('p2', 20000);
    item = useCartStore.getState().items[0];
    assert.equal(item.unitPrice, 20000);
    assert.equal(item.originalUnitPrice, 21500);
    assert.equal(useCartStore.getState().getSubtotal(), 40000);

    // Switch back to base unit => restores exact baseSellingPrice (1,000 K)
    useCartStore.getState().setItemUnit('p2', null);
    item = useCartStore.getState().items[0];
    assert.equal(item.unit, 'pcs');
    assert.equal(item.unitFactor, 1);
    assert.equal(item.unitPrice, 1000);
    store.clearCart();
  });
});

describe('Excel Data Migration v2.1 Workbook Formatting & Round-Trip', () => {
  it('generates a valid styled 24-sheet + Instructions workbook and round-trips all fields cleanly', async () => {
    const sampleDate = new Date('2026-11-23T08:30:00.000Z');
    const expiryDate = new Date('2027-06-30T00:00:00.000Z');
    const workbook = createDataMigrationWorkbook({
      Categories: [
        {
          id: 'cat-1',
          name: 'Beverages',
          nameMm: 'အချိုရည်',
          description: 'Cold drinks',
          slug: 'beverages',
          isActive: true,
          createdAt: sampleDate,
        },
      ],
      Products: [
        {
          id: 'prod-1',
          name: 'Energy Drink',
          nameMm: 'အားဖြည့်အချိုရည်',
          sku: 'DRK-001',
          barcode: '8850123456789',
          categoryId: 'beverages',
          costPrice: 700,
          sellingPrice: 1000,
          stockQuantity: 48.5,
          lowStockThreshold: 10,
          unit: 'pcs',
          batchNumber: 'B-2026-11',
          expiryDate,
          imageUrl: null,
          isActive: true,
          createdAt: sampleDate,
          updatedAt: sampleDate,
        },
      ],
      ProductUnits: [
        {
          id: 'pu-1',
          productId: 'DRK-001',
          unitName: 'carton',
          nameMm: 'ဖာ',
          conversionFactor: 24,
          sellingPrice: 22000,
          barcode: '8850123456796',
          createdAt: sampleDate,
          updatedAt: sampleDate,
        },
      ],
      Customers: [
        {
          id: 'cust-1',
          name: 'Daw Mya',
          phone: '09771234567',
          email: 'mya@example.com',
          address: 'Yangon',
          totalPurchases: 150000,
          creditBalance: 25000,
          creditLimit: 100000,
          loyaltyPoints: 150,
          createdAt: sampleDate,
          updatedAt: sampleDate,
        },
      ],
      Suppliers: [
        {
          id: 'sup-1',
          name: 'Golden Star Wholesale',
          contactPerson: 'U Hla',
          phone: '09440011223',
          email: null,
          address: 'Mandalay',
          creditBalance: 50000,
          notes: 'Net 15',
          isActive: true,
          createdAt: sampleDate,
          updatedAt: sampleDate,
        },
      ],
      InvoiceCounters: [
        { date: '20261123', counter: 12 },
        { date: 'PO-20261123', counter: 3 },
        { date: 'ST-20261124', counter: 1 },
        { date: 'QT-20261124', counter: 2 },
      ],
    });

    // 1 Instructions sheet + 24 operational data sheets = 25 sheets total
    assert.equal(Object.keys(DATA_MIGRATION_SHEETS).length, 24);
    assert.equal(workbook.length, 25);
    assert.equal(workbook[0].sheet, 'Instructions');

    const buffer = await workbookBuffer(workbook);
    assert.ok(buffer.length > 0);
    validateXlsxContainer(buffer);

    const parsed = await parseDataMigrationWorkbook(buffer);
    assert.equal(parsed.Products?.length, 1);
    assert.equal(parsed.Products?.[0].barcode, '8850123456789');
    assert.equal(parsed.Products?.[0].batchNumber, 'B-2026-11');
    assert.equal(parsed.Products?.[0].stockQuantity, 48.5);

    assert.equal(parsed.ProductUnits?.length, 1);
    assert.equal(parsed.ProductUnits?.[0].unitName, 'carton');
    assert.equal(parsed.ProductUnits?.[0].conversionFactor, 24);
    assert.equal(parsed.ProductUnits?.[0].barcode, '8850123456796');

    assert.equal(parsed.Customers?.length, 1);
    assert.equal(parsed.Customers?.[0].phone, '09771234567');
    assert.equal(parsed.Customers?.[0].creditBalance, 25000);
    assert.equal(parsed.Customers?.[0].creditLimit, 100000);

    assert.equal(parsed.Suppliers?.length, 1);
    assert.equal(parsed.Suppliers?.[0].name, 'Golden Star Wholesale');
    assert.equal(parsed.InvoiceCounters?.length, 4);
    assert.equal(parsed.InvoiceCounters?.[1].date, 'PO-20261123');
    assert.equal(parsed.InvoiceCounters?.[2].date, 'ST-20261124');
    assert.equal(parsed.InvoiceCounters?.[3].date, 'QT-20261124');
  });

  it('remains backward-compatible when parsing legacy v1 sheets missing newer optional columns', async () => {
    const legacyBuffer = await writeXlsxFile([
      {
        sheet: 'Customers',
        data: [
          ['id', 'name', 'phone', 'totalPurchases', 'loyaltyPoints'],
          ['c-legacy', 'U Ba', '09123456789', 5000, 5],
        ],
      },
      {
        sheet: 'Products',
        data: [
          ['id', 'name', 'sku', 'categoryId', 'sellingPrice', 'stockQuantity'],
          ['p-legacy', 'Legacy Tea', 'TEA-01', 'beverages', 1200, 10],
        ],
      },
    ]).toBuffer();

    const parsed = await parseDataMigrationWorkbook(legacyBuffer);
    assert.equal(parsed.Customers?.length, 1);
    assert.equal(parsed.Customers?.[0].name, 'U Ba');
    assert.equal(parsed.Products?.length, 1);
    assert.equal(parsed.Products?.[0].sku, 'TEA-01');
  });
});

describe('Promotions Engine (Best Single Discount, Non-Stacking)', () => {
  const now = new Date('2026-11-24T06:00:00.000Z');
  const start = new Date('2026-11-01T00:00:00.000Z');
  const end = new Date('2026-11-30T23:59:59.000Z');

  const lines: PromoCartLine[] = [
    { productId: 'p1', categoryId: 'cat-drink', quantity: 6, unitPrice: 1000, lineTotal: 6000 },
    { productId: 'p2', categoryId: 'cat-snack', quantity: 2, unitPrice: 5000, lineTotal: 10000 },
  ];

  const promos: EvaluablePromotion[] = [
    {
      id: 'promo-b5g1',
      name: 'Buy 5 Get 1 Free Drinks',
      code: null,
      type: 'BUY_X_GET_Y',
      discountValue: 0,
      buyQty: 5,
      getQty: 1,
      categoryId: 'cat-drink',
      startDate: start,
      endDate: end,
      isActive: true,
    },
    {
      id: 'promo-minspend',
      name: 'Spend 15k Save 2,500K',
      code: null,
      type: 'MIN_SPEND_FIXED',
      discountValue: 2500,
      minSpend: 15000,
      startDate: start,
      endDate: end,
      isActive: true,
    },
    {
      id: 'promo-vipcode',
      name: 'VIP 25% Code',
      code: 'VIP25',
      type: 'PERCENT_OFF',
      discountValue: 25,
      startDate: start,
      endDate: end,
      usageLimit: 10,
      usedCount: 2,
      isActive: true,
    },
  ];

  it('automatically picks the single highest auto-applied discount without stacking', () => {
    // Cart total = 16,000: B5G1 gives 1,000 K; MinSpend gives 2,500 K => Best Single = 2,500 K
    const res = evaluateBestPromotion(lines, promos, '', now);
    assert.equal(res.best?.promotion.id, 'promo-minspend');
    assert.equal(res.best?.discountAmount, 2500);
  });

  it('unlocks coupon code when entered and selects it if better than auto promos', () => {
    // VIP25 gives 25% of 16,000 = 4,000 K > 2,500 K
    const res = evaluateBestPromotion(lines, promos, 'vip25', now);
    assert.equal(res.codeMatched, true);
    assert.equal(res.best?.promotion.id, 'promo-vipcode');
    assert.equal(res.best?.discountAmount, 4000);
  });

  it('calculates Buy X Get Y free units cleanly on exact bundle multiples', () => {
    const res = evaluateBestPromotion([lines[0]], [promos[0]], '', now);
    assert.equal(res.best?.discountAmount, 1000);
  });
});

describe('AR/AP Aging Bucket Boundaries & Myanmar Calendar Days', () => {
  it('assigns exact day counts to 0-30, 31-60, 61-90, and 90+ buckets', () => {
    assert.equal(getAgingBucketKey(0), 'd0_30');
    assert.equal(getAgingBucketKey(30), 'd0_30');
    assert.equal(getAgingBucketKey(31), 'd31_60');
    assert.equal(getAgingBucketKey(60), 'd31_60');
    assert.equal(getAgingBucketKey(61), 'd61_90');
    assert.equal(getAgingBucketKey(90), 'd61_90');
    assert.equal(getAgingBucketKey(91), 'd90_plus');
  });

  it('computes exact calendar day differences across month boundaries without month-1 drift', () => {
    // 2026-03-01 to 2026-04-01 in MMT is exactly 31 days (d31_60)
    const mar1 = new Date('2026-03-01T06:00:00.000Z');
    const apr1 = new Date('2026-04-01T06:00:00.000Z');
    assert.equal(calculateMyanmarAgeDays(mar1, apr1), 31);
    assert.equal(getAgingBucketKey(calculateMyanmarAgeDays(mar1, apr1)), 'd31_60');

    // 2026-02-28 to 2026-03-30 in MMT is exactly 30 days (d0_30)
    const feb28 = new Date('2026-02-28T06:00:00.000Z');
    const mar30 = new Date('2026-03-30T06:00:00.000Z');
    assert.equal(calculateMyanmarAgeDays(feb28, mar30), 30);
    assert.equal(getAgingBucketKey(calculateMyanmarAgeDays(feb28, mar30)), 'd0_30');
  });
});

describe('Audit Regression Tests (MMK Calculator, Cart Coexistence, Mix-and-Match, XSS & Excel 32k)', () => {
  it('computes integer MMK totals identically (Math.round 0-decimal policy)', () => {
    assert.equal(roundMmk(-0), 0);
    // 1,205 K with 5% tax => 60.25 rounds to 60 => 1,265 K exact
    const line = calculateLineAmounts(1205, 1, 0);
    assert.equal(line.total, 1205);
    const totals = calculateOrderTotals({
      subtotal: line.gross,
      itemDiscountTotal: line.discount,
      cartDiscount: 0,
      promotionDiscount: 0,
      loyaltyDiscount: 0,
      taxRate: 5,
    });
    assert.equal(totals.taxAmount, 60);
    assert.equal(totals.totalAmount, 1265);

    // Fractional weight 0.3 kg x 10,001 K = 3,000.30 => 3,000 K
    assert.equal(calculateLineAmounts(10001, 0.3, 0).total, 3000);
  });

  it('keeps base unit and carton unit as separate cart lines & isolates held quotation/promo state', () => {
    const store = useCartStore.getState();
    store.clearCart();
    const cartonUnit = {
      id: 'u-carton-12',
      productId: 'p-drink',
      unitName: 'carton',
      nameMm: 'ဖာ',
      conversionFactor: 12,
      sellingPrice: 11000,
      barcode: '885000000012',
    };
    const product = {
      id: 'p-drink',
      name: 'Cola',
      nameMm: 'ကိုလာ',
      sku: 'COL-1',
      barcode: '885000000001',
      categoryId: 'cat-1',
      costPrice: 700,
      sellingPrice: 1000,
      stockQuantity: 15, // enough for 1 carton (12) + 3 loose pcs
      lowStockThreshold: 5,
      unit: 'pcs',
      imageUrl: null,
      isActive: true,
      createdAt: '',
      updatedAt: '',
      productUnits: [cartonUnit],
    };

    // Scan 1 carton then 1 loose pcs -> BOTH lines coexist without overwriting
    assert.equal(store.addItem(product, 1, cartonUnit), true);
    assert.equal(store.addItem(product, 1, null), true);
    assert.equal(useCartStore.getState().items.length, 2);
    assert.notEqual(
      getCartLineKey(useCartStore.getState().items[0]),
      getCartLineKey(useCartStore.getState().items[1])
    );

    // Try adding 5 more loose pcs -> clamped to 3 remaining base units (15 - 12 = 3)
    const looseKey = getCartLineKey(useCartStore.getState().items[1]);
    useCartStore.getState().updateQuantity(looseKey, 5);
    assert.equal(useCartStore.getState().items[1].quantity, 3);

    // Holding a bill with promoCode + activeQuotationId clears them from active cart and restores on resume
    useCartStore.getState().setPromoCode('VIP10');
    useCartStore.getState().loadQuotationItems(
      'quote-1',
      useCartStore.getState().items,
      500,
      { id: 'cust-1', name: 'Daw Mya', phone: '09123456' }
    );
    useCartStore.getState().setPromoCode('VIP10');
    assert.equal(useCartStore.getState().holdCurrentBill('Wholesale #1'), true);
    assert.equal(useCartStore.getState().activeQuotationId, null);
    assert.equal(useCartStore.getState().promoCode, '');
    assert.equal(useCartStore.getState().activeCustomer, null);

    const heldId = useCartStore.getState().heldBills[0].id;
    useCartStore.getState().resumeHeldBill(heldId);
    assert.equal(useCartStore.getState().activeQuotationId, 'quote-1');
    assert.equal(useCartStore.getState().promoCode, 'VIP10');
    assert.equal(useCartStore.getState().activeCustomer?.id, 'cust-1');
    useCartStore.getState().clearCart();
  });

  it('supports mix-and-match category BUY_X_GET_Y discounting cheapest eligible unit', () => {
    const promo: EvaluablePromotion = {
      id: 'mix-b2g1',
      name: 'Buy 2 Get 1 Drinks',
      code: null,
      type: 'BUY_X_GET_Y',
      discountValue: 0,
      buyQty: 2,
      getQty: 1,
      categoryId: 'cat-drink',
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2026-11-30T23:59:59Z'),
      isActive: true,
    };
    const mixLines: PromoCartLine[] = [
      { productId: 'p1', categoryId: 'cat-drink', quantity: 2, unitPrice: 1200, lineTotal: 2400 },
      { productId: 'p2', categoryId: 'cat-drink', quantity: 1, unitPrice: 600, lineTotal: 600 },
    ];
    const res = evaluateBestPromotion(mixLines, [promo], '', new Date('2026-11-24T06:00:00Z'));
    assert.equal(res.best?.discountAmount, 600);
  });

  it('escapes untrusted HTML/script payloads in print iframe titles', () => {
    const malicious = 'Mg</title><script>alert("xss")</script>';
    const escaped = escapePrintHtml(malicious);
    assert.equal(escaped.includes('<script>'), false);
    assert.equal(escaped.includes('</title>'), false);
    assert.equal(
      escaped,
      'Mg&lt;/title&gt;&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
    );
  });

  it('replaces oversized >32K base64 media cells with MEDIA_OMITTED_MARKER in Excel exports', async () => {
    const hugeBase64 = 'data:image/png;base64,' + 'A'.repeat(40_000);
    const workbook = createDataMigrationWorkbook({
      Settings: [
        {
          id: 'default',
          businessName: 'ShwePOS',
          businessNameMm: 'ရွှေPOS',
          address: null,
          phone: null,
          email: null,
          taxRate: 0,
          currencySymbol: 'K',
          loyaltyEnabled: true,
          loyaltyEarnRate: 1000,
          loyaltyRedeemRate: 10,
          mobileBankingName: 'KBZPay',
          mobileBankingQrUrl: hugeBase64,
          logo: hugeBase64,
          receiptFooter: null,
        },
      ],
    });
    const buf = await workbookBuffer(workbook);
    const parsed = await parseDataMigrationWorkbook(buf);
    assert.equal(parsed.Settings?.[0].mobileBankingQrUrl, MEDIA_OMITTED_MARKER);
    assert.equal(parsed.Settings?.[0].logo, MEDIA_OMITTED_MARKER);
  });
});

describe('Medium/Low Audit Hardening Regressions', () => {
  it('neutralizes CSV spreadsheet formula injection while preserving negative numbers', () => {
    assert.equal(escapeCsvCell('=CMD("calc")'), `"'=CMD(""calc"")"`);
    assert.equal(escapeCsvCell('+959123456'), `"'` + `+959123456"`);
    assert.equal(escapeCsvCell('@SUM(A1:A5)'), `"'@SUM(A1:A5)"`);
    assert.equal(escapeCsvCell('  -1+1'), `"'  -1+1"`);
    assert.equal(escapeCsvCell(-5000), '-5000');
    assert.equal(escapeCsvCell('Normal Customer'), '"Normal Customer"');
  });

  it('rejects SVG/javascript image URLs and permits safe raster data URLs and HTTPS URLs', () => {
    assert.equal(isSafeImageUrl('data:image/svg+xml;base64,PHN2Zz4='), false);
    assert.equal(isSafeImageUrl('javascript:alert(1)'), false);
    assert.equal(isSafeImageUrl('//evil.example/x.png'), false);
    assert.equal(isSafeImageUrl('data:image/webp;base64,UklGRh4AAABXRUJQ'), true);
    assert.equal(isSafeImageUrl('https://shwepos.vercel.app/logo.png'), true);
    assert.equal(isSafeImageUrl('/logo.png'), true);
  });

  it('evaluates getExpiryInfo using Myanmar calendar days without -0 between 00:00 and 06:29 MMT', () => {
    // 2026-11-24 01:30 MMT === 2026-11-23 19:00 UTC
    const nowMmt = new Date('2026-11-23T19:00:00.000Z');
    const expiredYesterday = parseMyanmarDateBoundary('2026-11-23', false)!;
    const infoExpired = getExpiryInfo(expiredYesterday, 30, nowMmt);
    assert.ok(infoExpired);
    assert.equal(infoExpired.status, 'expired');
    assert.equal(infoExpired.diffDays, -1);

    const expiresToday = parseMyanmarDateBoundary('2026-11-24', false)!;
    const infoToday = getExpiryInfo(expiresToday, 30, nowMmt);
    assert.ok(infoToday);
    assert.equal(infoToday.status, 'expiring_soon');
    assert.equal(Object.is(infoToday.diffDays, -0), false);
    assert.equal(infoToday.diffDays, 0);
  });

  it('evaluates MIN_SPEND_* promotions against post-cart-discount subtotal and returns coupon hints', () => {
    const minSpendPromo: EvaluablePromotion = {
      id: 'p-min50k',
      name: '5K Off 50K+',
      code: 'SAVE5K',
      type: 'MIN_SPEND_FIXED',
      discountValue: 5000,
      minSpend: 50000,
      startDate: new Date('2026-11-01T00:00:00Z'),
      endDate: new Date('2026-11-30T23:59:59Z'),
      isActive: true,
    };
    const lines: PromoCartLine[] = [
      { productId: 'p1', categoryId: 'c1', quantity: 1, unitPrice: 52000, lineTotal: 52000 },
    ];
    // With 0 cart discount (52,000 >= 50,000) => qualifies
    const qualified = evaluateBestPromotion(lines, [minSpendPromo], 'SAVE5K', new Date('2026-11-24T06:00:00Z'), 0);
    assert.equal(qualified.best?.discountAmount, 5000);
    assert.equal(qualified.codeFailureReason, null);

    // With 5,000 manual cart discount (47,000 < 50,000) => does NOT qualify and surfaces MIN_SPEND_NOT_MET
    const dropped = evaluateBestPromotion(lines, [minSpendPromo], 'SAVE5K', new Date('2026-11-24T06:00:00Z'), 5000);
    assert.equal(dropped.best, null);
    assert.equal(dropped.codeFailureReason, 'MIN_SPEND_NOT_MET');
  });

  it('excludes OPENING and CLOSING snapshot rows from summarizeShiftCash movementCount', () => {
    const summary = summarizeShiftCash(10000, [
      { type: 'OPENING', amount: 10000 },
      { type: 'CASH_SALE', amount: 5000 },
      { type: 'PAID_OUT', amount: 1000 },
      { type: 'CLOSING', amount: 14000 },
    ]);
    assert.equal(summary.expectedCash, 14000);
    assert.equal(summary.movementCount, 2);
  });
});
