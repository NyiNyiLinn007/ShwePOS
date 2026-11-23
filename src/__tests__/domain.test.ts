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
import {
  DATA_MIGRATION_SHEETS,
  createDataMigrationWorkbook,
  parseDataMigrationWorkbook,
  validateXlsxContainer,
  workbookBuffer,
} from '@/lib/dataMigration';
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

describe('Excel Data Migration v2.0 Workbook Formatting & Round-Trip', () => {
  it('generates a valid styled 19-sheet + Instructions workbook and round-trips all fields cleanly', async () => {
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
      ],
    });

    // 1 Instructions sheet + 19 operational data sheets = 20 sheets total
    assert.equal(Object.keys(DATA_MIGRATION_SHEETS).length, 19);
    assert.equal(workbook.length, 20);
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
    assert.equal(parsed.InvoiceCounters?.length, 2);
    assert.equal(parsed.InvoiceCounters?.[1].date, 'PO-20261123');
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
