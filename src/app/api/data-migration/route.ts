import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'node:crypto';
import prisma from '@/lib/prisma';
import {
  createDataMigrationWorkbook,
  DataMigrationError,
  importDataMigration,
  parseDataMigrationWorkbook,
  validateXlsxContainer,
  workbookBuffer,
  type MigrationRows,
} from '@/lib/dataMigration';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';
import { consumeRateLimit } from '@/lib/rateLimit';
import { getMyanmarDateCompact } from '@/lib/utils';
import { logAudit } from '@/services/auditService';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 15 * 1024 * 1024;

async function allData(): Promise<MigrationRows> {
  const [
    users,
    categories,
    products,
    productUnits,
    customers,
    suppliers,
    purchaseOrders,
    purchaseItems,
    supplierPayments,
    shifts,
    sales,
    saleItems,
    salePayments,
    saleAdjustments,
    stockMovements,
    expenses,
    cashDrawerMovements,
    promotions,
    quotations,
    quotationItems,
    stocktakeSessions,
    stocktakeItems,
    settings,
    invoiceCounters,
  ] = await Promise.all([
    // Never export password hashes or session internals. Existing users can be
    // matched by id/email on import and keep their current password.
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.category.findMany({ orderBy: { name: 'asc' } }),
    prisma.product.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.productUnit.findMany({ orderBy: [{ productId: 'asc' }, { conversionFactor: 'asc' }] }),
    prisma.customer.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.supplier.findMany({ orderBy: { name: 'asc' } }),
    prisma.purchaseOrder.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.purchaseItem.findMany(),
    prisma.supplierPayment.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.shift.findMany({ orderBy: { openedAt: 'asc' } }),
    prisma.sale.findMany({ orderBy: { createdAt: 'asc' } }).then((rows) =>
      rows.map(
        ({
          paymentReference: _paymentReference,
          paymentProviderResponse: _paymentProviderResponse,
          ...sale
        }) => ({
          ...sale,
          // Payment references/provider responses may contain tokens or private
          // gateway payloads. They are intentionally not copied into exports.
          paymentReference: null,
          paymentProviderResponse: null,
        })
      )
    ),
    prisma.saleItem.findMany(),
    prisma.salePayment.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.saleAdjustment.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.stockMovement.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.expense.findMany({ orderBy: { date: 'asc' } }),
    prisma.cashDrawerMovement.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.promotion.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.quotation.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.quotationItem.findMany(),
    prisma.stocktakeSession.findMany({ orderBy: { createdAt: 'asc' } }),
    prisma.stocktakeItem.findMany(),
    prisma.settings.findMany(),
    prisma.invoiceCounter.findMany({ orderBy: { date: 'asc' } }),
  ]);

  return {
    Users: users,
    Categories: categories,
    Products: products,
    ProductUnits: productUnits,
    Customers: customers,
    Suppliers: suppliers,
    PurchaseOrders: purchaseOrders,
    PurchaseItems: purchaseItems,
    SupplierPayments: supplierPayments,
    Shifts: shifts,
    Sales: sales,
    SaleItems: saleItems,
    SalePayments: salePayments,
    SaleAdjustments: saleAdjustments,
    StockMovements: stockMovements,
    Expenses: expenses,
    CashDrawerMovements: cashDrawerMovements,
    Promotions: promotions,
    Quotations: quotations,
    QuotationItems: quotationItems,
    StocktakeSessions: stocktakeSessions,
    StocktakeItems: stocktakeItems,
    Settings: settings,
    InvoiceCounters: invoiceCounters,
  } as unknown as MigrationRows;
}

function excelResponse(buffer: Buffer, filename: string): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  });
}

export async function GET(request: NextRequest) {
  try {
    const operator = await requireRole('ADMIN');
    const downloadLimit = await consumeRateLimit(`data-migration:download:${operator.id}`, {
      limit: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!downloadLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many migration downloads. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(downloadLimit.retryAfterSeconds) } }
      );
    }
    const mode = request.nextUrl.searchParams.get('mode') || 'template';
    if (mode !== 'template' && mode !== 'export') {
      return NextResponse.json({ error: 'Invalid download mode' }, { status: 400 });
    }

    const data = mode === 'export' ? await allData() : {};
    const workbook = createDataMigrationWorkbook(data);
    const dateStamp = getMyanmarDateCompact();
    const filename =
      mode === 'export'
        ? `shwepos-data-export-${dateStamp}.xlsx`
        : `shwepos-data-migration-template-v2.xlsx`;
    return excelResponse(await workbookBuffer(workbook), filename);
  } catch (error) {
    return handleApiError(error, 'Failed to create Excel workbook');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const operator = await requireRole('ADMIN');
    const importLimit = await consumeRateLimit(`data-migration:import:${operator.id}`, {
      limit: 3,
      windowMs: 60 * 60 * 1000,
    });
    if (!importLimit.allowed) {
      return NextResponse.json(
        { error: 'Too many migration imports. Please try again later.' },
        { status: 429, headers: { 'Retry-After': String(importLimit.retryAfterSeconds) } }
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      return NextResponse.json(
        { error: 'Please choose an Excel file to import' },
        { status: 400 }
      );
    }

    const upload = file as {
      arrayBuffer: () => Promise<ArrayBuffer>;
      size?: number;
      name?: string;
    };
    if ((upload.size ?? 0) > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Excel file must be 15 MB or smaller' }, { status: 400 });
    }

    const filename = (upload.name || '').toLowerCase();
    if (!filename.endsWith('.xlsx')) {
      return NextResponse.json({ error: 'Only .xlsx files are supported' }, { status: 400 });
    }

    const buffer = Buffer.from(await upload.arrayBuffer());
    if (buffer.length > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Excel file must be 15 MB or smaller' }, { status: 400 });
    }
    validateXlsxContainer(buffer);

    const rows = await parseDataMigrationWorkbook(buffer);
    const summary = await importDataMigration(prisma, rows);
    const total = Object.values(summary).reduce((sum, count) => sum + count, 0);
    const safeFileName = (upload.name || 'upload.xlsx')
      .replace(/[^a-zA-Z0-9._ -]/g, '_')
      .slice(0, 255);

    await prisma.dataMigrationAudit.create({
      data: {
        userId: operator.id,
        action: 'IMPORT',
        fileName: safeFileName,
        fileHash: createHash('sha256').update(buffer).digest('hex'),
        rowCount: total,
        summary,
      },
    });

    await logAudit({
      userId: operator.id,
      action: 'DATA_MIGRATION_IMPORT',
      entityType: 'DATA_MIGRATION',
      summary: `Imported ${total.toLocaleString()} record(s) from ${safeFileName}`,
      metadata: {
        fileName: safeFileName,
        rowCount: total,
        summary,
      },
    });

    return NextResponse.json(
      {
        message: `Imported ${total.toLocaleString()} record(s) successfully`,
        summary,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    if (error instanceof DataMigrationError) {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: error.status }
      );
    }
    return handleApiError(error, 'Failed to import Excel data');
  }
}
