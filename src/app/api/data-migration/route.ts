import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import {
  createDataMigrationWorkbook,
  DataMigrationError,
  importDataMigration,
  parseDataMigrationWorkbook,
  workbookBuffer,
  type MigrationRows,
} from '@/lib/dataMigration';
import { handleApiError, requireRole, validateCsrf } from '@/lib/apiAuth';

export const runtime = 'nodejs';

const MAX_FILE_SIZE = 15 * 1024 * 1024;

async function allData(): Promise<MigrationRows> {
  const [users, categories, products, customers, sales, saleItems, stockMovements, expenses, shifts, cashDrawerMovements, saleAdjustments, settings, invoiceCounters] = await Promise.all([
    prisma.user.findMany(),
    prisma.category.findMany(),
    prisma.product.findMany(),
    prisma.customer.findMany(),
    prisma.sale.findMany(),
    prisma.saleItem.findMany(),
    prisma.stockMovement.findMany(),
    prisma.expense.findMany(),
    prisma.shift.findMany(),
    prisma.cashDrawerMovement.findMany(),
    prisma.saleAdjustment.findMany(),
    prisma.settings.findMany(),
    prisma.invoiceCounter.findMany(),
  ]);

  return {
    Users: users,
    Categories: categories,
    Products: products,
    Customers: customers,
    Sales: sales,
    SaleItems: saleItems,
    StockMovements: stockMovements,
    Expenses: expenses,
    Shifts: shifts,
    CashDrawerMovements: cashDrawerMovements,
    SaleAdjustments: saleAdjustments,
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
    await requireRole('ADMIN');
    const mode = request.nextUrl.searchParams.get('mode') || 'template';
    if (mode !== 'template' && mode !== 'export') {
      return NextResponse.json({ error: 'Invalid download mode' }, { status: 400 });
    }

    const data = mode === 'export' ? await allData() : {};
    const workbook = createDataMigrationWorkbook(data);
    const filename = mode === 'export' ? 'shwepos-data-export.xlsx' : 'shwepos-data-migration-template.xlsx';
    return excelResponse(workbookBuffer(workbook), filename);
  } catch (error) {
    return handleApiError(error, 'Failed to create Excel workbook');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    await requireRole('ADMIN');

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file !== 'object' || !('arrayBuffer' in file)) {
      return NextResponse.json({ error: 'Please choose an Excel file to import' }, { status: 400 });
    }

    const upload = file as { arrayBuffer: () => Promise<ArrayBuffer>; size?: number; name?: string };
    if ((upload.size ?? 0) > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Excel file must be 15 MB or smaller' }, { status: 400 });
    }

    const filename = (upload.name || '').toLowerCase();
    if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
      return NextResponse.json({ error: 'Only .xlsx and .xls files are supported' }, { status: 400 });
    }

    const rows = parseDataMigrationWorkbook(Buffer.from(await upload.arrayBuffer()));
    const summary = await importDataMigration(prisma, rows);
    const total = Object.values(summary).reduce((sum, count) => sum + count, 0);

    return NextResponse.json({
      message: `Imported ${total.toLocaleString()} record(s) successfully`,
      summary,
    });
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
