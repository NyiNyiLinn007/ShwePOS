import readXlsxFile from 'read-excel-file/node';
import writeXlsxFile, { type SheetData } from 'write-excel-file/node';
import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient } from '@prisma/client';

export const DATA_MIGRATION_SHEETS = {
  Users: {
    headers: ['id', 'name', 'email', 'password', 'role', 'phone', 'isActive', 'sessionVersion', 'lastLoginAt', 'createdAt', 'updatedAt'],
    required: ['name', 'email'],
    description: 'System users. Password is not exported. Existing users keep their current password; new users require a strong password.',
  },
  Categories: {
    headers: ['id', 'name', 'nameMm', 'description', 'slug', 'isActive', 'createdAt'],
    required: ['name', 'slug'],
    description: 'Product categories. Products can refer to category id, slug, or name.',
  },
  Products: {
    headers: ['id', 'name', 'nameMm', 'sku', 'barcode', 'categoryId', 'costPrice', 'sellingPrice', 'stockQuantity', 'lowStockThreshold', 'unit', 'imageUrl', 'isActive', 'createdAt', 'updatedAt'],
    required: ['name', 'sku', 'categoryId'],
    description: 'Products. categoryId accepts a category id, slug, or exact name.',
  },
  Customers: {
    headers: ['id', 'name', 'phone', 'email', 'address', 'totalPurchases', 'loyaltyPoints', 'createdAt', 'updatedAt'],
    required: ['name'],
    description: 'Customers. Phone is used as the unique key when id is blank.',
  },
  Sales: {
    headers: ['id', 'invoiceNumber', 'clientSaleId', 'customerId', 'userId', 'subtotal', 'discountAmount', 'taxAmount', 'totalAmount', 'paidAmount', 'changeAmount', 'paymentMethod', 'paymentStatus', 'paymentReference', 'paymentProviderResponse', 'status', 'notes', 'createdAt'],
    required: ['invoiceNumber', 'userId'],
    description: 'Sales. userId accepts a user id or email; customerId accepts a customer id or phone.',
  },
  SaleItems: {
    headers: ['id', 'saleId', 'productId', 'quantity', 'unitPrice', 'costPrice', 'discount', 'total'],
    required: ['saleId', 'productId', 'quantity'],
    description: 'Sale line items. saleId accepts a sale id or invoice number; productId accepts a product id or SKU.',
  },
  StockMovements: {
    headers: ['id', 'productId', 'userId', 'saleId', 'quantity', 'type', 'reason', 'previousStock', 'newStock', 'createdAt'],
    required: ['productId', 'userId', 'quantity', 'type', 'previousStock', 'newStock'],
    description: 'Inventory movement history. Importing this sheet does not recalculate product stock.',
  },
  Expenses: {
    headers: ['id', 'category', 'amount', 'description', 'userId', 'date', 'createdAt'],
    required: ['category', 'amount', 'userId'],
    description: 'Expenses. userId accepts a user id or email.',
  },
  Shifts: {
    headers: ['id', 'userId', 'openingCash', 'closingCash', 'expectedCash', 'actualCash', 'variance', 'status', 'openedAt', 'closedAt', 'notes'],
    required: ['userId', 'openingCash', 'status', 'openedAt'],
    description: 'Cashier shifts. userId accepts a user id or email.',
  },
  CashDrawerMovements: {
    headers: ['id', 'shiftId', 'saleId', 'expenseId', 'userId', 'type', 'amount', 'reason', 'createdAt'],
    required: ['userId', 'type', 'amount'],
    description: 'Cash drawer movements. saleId accepts a sale id or invoice number.',
  },
  SaleAdjustments: {
    headers: ['id', 'saleId', 'approverUserId', 'type', 'reason', 'amount', 'paymentMethod', 'paymentReversalStatus', 'createdAt'],
    required: ['saleId', 'approverUserId', 'type', 'reason', 'amount', 'paymentMethod'],
    description: 'Sale refunds and void adjustments. saleId accepts a sale id or invoice number.',
  },
  Settings: {
    headers: ['id', 'businessName', 'businessNameMm', 'address', 'phone', 'email', 'taxRate', 'currencySymbol', 'logo', 'receiptFooter'],
    required: ['businessName', 'taxRate', 'currencySymbol'],
    description: 'Business settings. The default settings row uses id = default.',
  },
  InvoiceCounters: {
    headers: ['date', 'counter'],
    required: ['date', 'counter'],
    description: 'Invoice number counters. date format is YYYYMMDD.',
  },
} as const;

export type MigrationSheetName = keyof typeof DATA_MIGRATION_SHEETS;
export type MigrationRows = Partial<Record<MigrationSheetName, Record<string, unknown>[]>>;

export class DataMigrationError extends Error {
  status = 400;
  details?: Array<{ sheet?: string; row?: number; message: string }>;

  constructor(message: string, details?: DataMigrationError['details']) {
    super(message);
    this.name = 'DataMigrationError';
    this.details = details;
  }
}

const INSTRUCTIONS_SHEET = 'Instructions';
const MAX_IMPORT_ROWS = 100_000;
const MAX_IMPORT_COLUMNS = 64;

const USER_ROLES = new Set(['ADMIN', 'MANAGER', 'CASHIER']);
const PAYMENT_METHODS = new Set(['CASH', 'CARD', 'MOBILE_BANKING', 'CREDIT']);
const PAYMENT_STATUSES = new Set(['PAID', 'PENDING', 'FAILED', 'REVERSED']);
const SALE_STATUSES = new Set(['COMPLETED', 'REFUNDED', 'VOIDED']);
const MOVEMENT_TYPES = new Set(['IN', 'OUT', 'ADJUSTMENT', 'RETURN']);
const SHIFT_STATUSES = new Set(['OPEN', 'CLOSED']);
const CASH_MOVEMENT_TYPES = new Set(['OPENING', 'CASH_SALE', 'REFUND', 'VOID', 'PAID_IN', 'PAID_OUT', 'CLOSING']);
const ADJUSTMENT_TYPES = new Set(['REFUND', 'VOID']);
const REVERSAL_STATUSES = new Set(['PENDING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED']);
const PRODUCT_UNITS = new Set(['pcs', 'kg', 'g', 'liter', 'ml', 'pack', 'box', 'bottle', 'dozen', 'set']);
const MAX_MIGRATION_MONEY = 1_000_000_000_000;
const MAX_MIGRATION_INTEGER = 1_000_000_000;
const MAX_XLSX_ENTRIES = 2_000;
const MAX_XLSX_UNCOMPRESSED_SIZE = 128 * 1024 * 1024;

/** Reject ZIP bombs and malformed containers before invoking the XLSX parser. */
export function validateXlsxContainer(buffer: Buffer): void {
  if (buffer.length < 22 || buffer.subarray(0, 4).toString('hex') !== '504b0304') {
    throw new DataMigrationError('The uploaded file is not a valid .xlsx workbook');
  }

  const endRecordSignature = Buffer.from([0x50, 0x4b, 0x05, 0x06]);
  const endRecordOffset = buffer.lastIndexOf(endRecordSignature);
  if (endRecordOffset < 0 || endRecordOffset + 22 > buffer.length) {
    throw new DataMigrationError('The uploaded file has an invalid ZIP directory');
  }

  const centralDirectorySize = buffer.readUInt32LE(endRecordOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endRecordOffset + 16);
  if (centralDirectorySize === 0xffffffff || centralDirectoryOffset === 0xffffffff) {
    throw new DataMigrationError('ZIP64 workbooks are not supported');
  }
  const centralDirectoryEnd = centralDirectoryOffset + centralDirectorySize;
  if (centralDirectoryEnd > buffer.length) {
    throw new DataMigrationError('The uploaded file has an invalid ZIP directory');
  }

  let entries = 0;
  let uncompressedSize = 0;
  let cursor = centralDirectoryOffset;
  while (cursor < centralDirectoryEnd) {
    if (cursor + 46 > centralDirectoryEnd || buffer.readUInt32LE(cursor) !== 0x02014b50) {
      throw new DataMigrationError('The uploaded file has an invalid ZIP entry');
    }
    const compressedSize = buffer.readUInt32LE(cursor + 20);
    const entrySize = buffer.readUInt32LE(cursor + 24);
    const fileNameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const entryEnd = cursor + 46 + fileNameLength + extraLength + commentLength;
    if (entryEnd > centralDirectoryEnd) {
      throw new DataMigrationError('The uploaded file has an invalid ZIP entry');
    }
    const fileName = buffer.subarray(cursor + 46, cursor + 46 + fileNameLength).toString('utf8');
    if (fileName.startsWith('/') || fileName.split('/').includes('..')) {
      throw new DataMigrationError('The uploaded file contains an unsafe ZIP path');
    }
    if (compressedSize > buffer.length || entrySize > MAX_XLSX_UNCOMPRESSED_SIZE) {
      throw new DataMigrationError('The uploaded workbook contains an oversized ZIP entry');
    }
    entries += 1;
    uncompressedSize += entrySize;
    if (entries > MAX_XLSX_ENTRIES || uncompressedSize > MAX_XLSX_UNCOMPRESSED_SIZE) {
      throw new DataMigrationError('The uploaded workbook is too large after decompression');
    }
    cursor = entryEnd;
  }

  if (entries === 0 || cursor !== centralDirectoryEnd) {
    throw new DataMigrationError('The uploaded workbook contains no ZIP entries');
  }
}

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function stringValue(value: unknown): string | null {
  if (isBlank(value)) return null;
  const text = String(value).trim();
  // Excel commonly prefixes formula-like text with an apostrophe. Remove only
  // the protection marker we add on export, never arbitrary user apostrophes.
  return /^'[=+\-@]/.test(text) ? text.slice(1) : text;
}

function requiredString(row: Record<string, unknown>, field: string, sheet: string, rowNumber: number): string {
  const value = stringValue(row[field]);
  if (!value) {
    throw new DataMigrationError(`Missing required value: ${field}`, [
      { sheet, row: rowNumber, message: `${field} is required` },
    ]);
  }
  return value;
}

function numberValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  required = false
): number | null {
  const raw = row[field];
  if (isBlank(raw)) {
    if (required) requiredString(row, field, sheet, rowNumber);
    return null;
  }
  const value = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, '').trim());
  if (!Number.isFinite(value)) {
    throw new DataMigrationError(`Invalid number in ${field}`, [
      { sheet, row: rowNumber, message: `${field} must be a valid number` },
    ]);
  }
  if (Math.abs(value) > MAX_MIGRATION_MONEY) {
    throw new DataMigrationError(`Number in ${field} is too large`, [
      { sheet, row: rowNumber, message: `${field} is outside the supported range` },
    ]);
  }
  return value;
}

function integerValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  required = false
): number | null {
  const value = numberValue(row, field, sheet, rowNumber, required);
  if (value === null) return null;
  if (!Number.isInteger(value)) {
    throw new DataMigrationError(`Invalid integer in ${field}`, [
      { sheet, row: rowNumber, message: `${field} must be a whole number` },
    ]);
  }
  if (Math.abs(value) > MAX_MIGRATION_INTEGER) {
    throw new DataMigrationError(`Integer in ${field} is too large`, [
      { sheet, row: rowNumber, message: `${field} is outside the supported range` },
    ]);
  }
  return value;
}

function migrationError(field: string, message: string, sheet: string, rowNumber: number): never {
  throw new DataMigrationError(`Invalid ${field}`, [
    { sheet, row: rowNumber, message },
  ]);
}

function nonNegativeNumberValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  required = false
): number | null {
  const value = numberValue(row, field, sheet, rowNumber, required);
  if (value !== null && value < 0) migrationError(field, `${field} cannot be negative`, sheet, rowNumber);
  return value;
}

function positiveNumberValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  required = false
): number | null {
  const value = numberValue(row, field, sheet, rowNumber, required);
  if (value !== null && value <= 0) migrationError(field, `${field} must be positive`, sheet, rowNumber);
  return value;
}

function nonNegativeIntegerValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  required = false
): number | null {
  const value = integerValue(row, field, sheet, rowNumber, required);
  if (value !== null && value < 0) migrationError(field, `${field} cannot be negative`, sheet, rowNumber);
  return value;
}

function positiveIntegerValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  required = false
): number | null {
  const value = integerValue(row, field, sheet, rowNumber, required);
  if (value !== null && value <= 0) migrationError(field, `${field} must be positive`, sheet, rowNumber);
  return value;
}

function enumValue(
  row: Record<string, unknown>,
  field: string,
  allowed: Set<string>,
  sheet: string,
  rowNumber: number,
  defaultValue?: string
): string {
  const value = stringValue(row[field]) || defaultValue;
  if (!value || !allowed.has(value)) {
    migrationError(field, `${field} must be one of: ${Array.from(allowed).join(', ')}`, sheet, rowNumber);
  }
  return value;
}

function boundedString(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  maxLength: number,
  required = false
): string | null {
  const value = required ? requiredString(row, field, sheet, rowNumber) : stringValue(row[field]);
  if (value && value.length > maxLength) {
    migrationError(field, `${field} cannot exceed ${maxLength} characters`, sheet, rowNumber);
  }
  return value;
}

function booleanValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  defaultValue = false
): boolean {
  const raw = row[field];
  if (isBlank(raw)) return defaultValue;
  if (typeof raw === 'boolean') return raw;
  const normalized = String(raw).trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n'].includes(normalized)) return false;
  throw new DataMigrationError(`Invalid boolean in ${field}`, [
    { sheet, row: rowNumber, message: `${field} must be true/false, yes/no, or 1/0` },
  ]);
}

function dateValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  required = false
): Date | null {
  const raw = row[field];
  if (isBlank(raw)) {
    if (required) requiredString(row, field, sheet, rowNumber);
    return null;
  }

  let value: Date;
  if (raw instanceof Date) {
    value = raw;
  } else if (typeof raw === 'number') {
    value = new Date(Date.UTC(1899, 11, 30) + raw * 86_400_000);
  } else {
    value = new Date(String(raw).trim());
  }

  if (Number.isNaN(value.getTime())) {
    throw new DataMigrationError(`Invalid date in ${field}`, [
      { sheet, row: rowNumber, message: `${field} must be a valid date or ISO date string` },
    ]);
  }
  return value;
}

function nullableString(row: Record<string, unknown>, field: string): string | null {
  return stringValue(row[field]);
}

function inputId(row: Record<string, unknown>): string | null {
  return stringValue(row.id);
}

function isEmptyRow(row: Record<string, unknown>): boolean {
  return Object.values(row).every(isBlank);
}

type SpreadsheetCell = string | number | boolean | Date | null;
type MigrationWorkbook = Array<{
  data: SheetData;
  sheet: string;
  columns: Array<{ width: number }>;
  stickyRowsCount?: number;
  dateFormat?: string;
}>;

function workbookRows(workbook: Array<{ sheet: string; data: Array<Array<unknown>> }>): MigrationRows {
  const knownNames = new Set<string>(Object.keys(DATA_MIGRATION_SHEETS));
  const unknownSheets = workbook.map(({ sheet }) => sheet).filter(
    (name) => name !== INSTRUCTIONS_SHEET && !knownNames.has(name)
  );
  if (unknownSheets.length > 0) {
    throw new DataMigrationError(`Unsupported sheet(s): ${unknownSheets.join(', ')}`);
  }

  const result: MigrationRows = {};
  let totalRows = 0;

  for (const { sheet: sheetName, data: matrix } of workbook) {
    if (sheetName === INSTRUCTIONS_SHEET) continue;
    const definition = DATA_MIGRATION_SHEETS[sheetName as MigrationSheetName];

    if (matrix.length === 0) continue;
    const headerRow = (matrix[0] ?? []).map((value) => String(value ?? '').trim().replace(/^\uFEFF/, ''));
    if (headerRow.length > MAX_IMPORT_COLUMNS) {
      throw new DataMigrationError(`A sheet cannot contain more than ${MAX_IMPORT_COLUMNS} columns`, [
        { sheet: sheetName, row: 1, message: 'Too many columns' },
      ]);
    }
    const missingHeaders = definition.headers.filter((header) => !headerRow.includes(header));
    if (missingHeaders.length > 0) {
      throw new DataMigrationError(`Invalid ${sheetName} sheet headers`, [
        { sheet: sheetName, row: 1, message: `Missing columns: ${missingHeaders.join(', ')}` },
      ]);
    }

    const rows: Record<string, unknown>[] = [];
    for (let index = 1; index < matrix.length; index += 1) {
      const values = matrix[index] ?? [];
      const row: Record<string, unknown> = {};
      headerRow.forEach((header, columnIndex) => {
        if (header) row[header] = values[columnIndex] ?? null;
      });
      if (!isEmptyRow(row)) {
        rows.push(row);
        totalRows += 1;
      }
    }

    if (totalRows > MAX_IMPORT_ROWS) {
      throw new DataMigrationError(`Import is limited to ${MAX_IMPORT_ROWS.toLocaleString()} rows`);
    }
    result[sheetName as MigrationSheetName] = rows;
  }

  if (Object.keys(result).length === 0) {
    throw new DataMigrationError('No data sheets were found in the workbook');
  }

  return result;
}

export async function parseDataMigrationWorkbook(buffer: Buffer): Promise<MigrationRows> {
  try {
    const workbook = await readXlsxFile(buffer);
    return workbookRows(workbook as unknown as Array<{ sheet: string; data: Array<Array<unknown>> }>);
  } catch (error) {
    if (error instanceof DataMigrationError) throw error;
    throw new DataMigrationError('The uploaded file is not a readable Excel workbook');
  }
}

function exportValue(value: unknown): SpreadsheetCell {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (typeof value === 'string') {
    // Prevent spreadsheet formula injection when data originated from users.
    return /^[=+\-@]/.test(value) ? `'${value}` : value;
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function rowsForSheet(rows: unknown[], headers: readonly string[]): Array<Array<SpreadsheetCell>> {
  return rows.map((row) => headers.map((header) => exportValue((row as Record<string, unknown>)[header])));
}

export function createDataMigrationWorkbook(data: MigrationRows = {}): MigrationWorkbook {
  const workbook: MigrationWorkbook = [];
  const instructions = [
    ['ShwePOS Data Migration Workbook'],
    ['How to use'],
    ['1. For a new migration, download the template, fill the data sheets, and keep the column names unchanged.'],
    ['2. For a complete backup/migration, use Export All Data and import that workbook into another ShwePOS database.'],
    ['3. Blank id cells are allowed for new records. Existing ids can be kept to update/migrate the same records.'],
    ['4. Relation fields accept ids and selected natural keys (category slug/name, product SKU, invoice number, user email).'],
    ['5. Import is additive/upsert. It does not delete records that are not included in the workbook.'],
    ['6. Users: password is blank in exports. Existing users keep their current password; enter a password only for a new user.'],
    ['7. Do not place passwords, payment secrets, or other sensitive data in this workbook.'],
    [],
    ['Sheet', 'Required fields', 'Notes'],
    ...Object.entries(DATA_MIGRATION_SHEETS).map(([name, definition]) => [
      name,
      definition.required.join(', '),
      definition.description,
    ]),
  ];
  workbook.push({
    data: instructions,
    sheet: INSTRUCTIONS_SHEET,
    columns: [{ width: 24 }, { width: 42 }, { width: 110 }],
    stickyRowsCount: 1,
  });

  for (const [sheetName, definition] of Object.entries(DATA_MIGRATION_SHEETS)) {
    const rows = data[sheetName as MigrationSheetName] ?? [];
    workbook.push({
      data: [
        [...definition.headers],
        ...rowsForSheet(rows, definition.headers),
      ],
      sheet: sheetName,
      columns: definition.headers.map((header) => ({
        width: Math.min(34, Math.max(14, header.length + 3)),
      })),
      stickyRowsCount: 1,
      dateFormat: 'yyyy-mm-dd hh:mm:ss',
    });
  }

  return workbook;
}

export async function workbookBuffer(workbook: MigrationWorkbook): Promise<Buffer> {
  return writeXlsxFile(workbook).toBuffer();
}

type ImportClient = Prisma.TransactionClient;

interface ImportMaps {
  usersById: Map<string, string>;
  usersByEmail: Map<string, string>;
  categoriesById: Map<string, string>;
  categoriesBySlug: Map<string, string>;
  categoriesByName: Map<string, string>;
  productsById: Map<string, string>;
  productsBySku: Map<string, string>;
  customersById: Map<string, string>;
  customersByPhone: Map<string, string>;
  salesById: Map<string, string>;
  salesByInvoice: Map<string, string>;
  expensesById: Map<string, string>;
  shiftsById: Map<string, string>;
}

function createImportMaps(): ImportMaps {
  return {
    usersById: new Map(),
    usersByEmail: new Map(),
    categoriesById: new Map(),
    categoriesBySlug: new Map(),
    categoriesByName: new Map(),
    productsById: new Map(),
    productsBySku: new Map(),
    customersById: new Map(),
    customersByPhone: new Map(),
    salesById: new Map(),
    salesByInvoice: new Map(),
    expensesById: new Map(),
    shiftsById: new Map(),
  };
}

function relationError(field: string, value: string, sheet: string, row: number): never {
  throw new DataMigrationError(`Cannot resolve ${field}: ${value}`, [
    { sheet, row, message: `${field} reference does not exist` },
  ]);
}

async function resolveUser(tx: ImportClient, raw: unknown, maps: ImportMaps, sheet: string, row: number): Promise<string> {
  const value = stringValue(raw);
  if (!value) return relationError('userId', '', sheet, row);
  const byMap = maps.usersById.get(value) ?? maps.usersByEmail.get(value.toLowerCase());
  if (byMap) return byMap;
  const user = value.includes('@')
    ? await tx.user.findUnique({ where: { email: value.toLowerCase() }, select: { id: true } })
    : await tx.user.findUnique({ where: { id: value }, select: { id: true } });
  if (!user) return relationError('userId', value, sheet, row);
  return user.id;
}

async function resolveCategory(tx: ImportClient, raw: unknown, maps: ImportMaps, sheet: string, row: number): Promise<string> {
  const value = stringValue(raw);
  if (!value) return relationError('categoryId', '', sheet, row);
  const byMap = maps.categoriesById.get(value) ?? maps.categoriesBySlug.get(value) ?? maps.categoriesByName.get(value);
  if (byMap) return byMap;
  const category = await tx.category.findFirst({
    where: { OR: [{ id: value }, { slug: value }, { name: value }] },
    select: { id: true },
  });
  if (!category) return relationError('categoryId', value, sheet, row);
  return category.id;
}

async function resolveProduct(tx: ImportClient, raw: unknown, maps: ImportMaps, sheet: string, row: number): Promise<string> {
  const value = stringValue(raw);
  if (!value) return relationError('productId', '', sheet, row);
  const byMap = maps.productsById.get(value) ?? maps.productsBySku.get(value);
  if (byMap) return byMap;
  const product = await tx.product.findFirst({
    where: { OR: [{ id: value }, { sku: value }] },
    select: { id: true },
  });
  if (!product) return relationError('productId', value, sheet, row);
  return product.id;
}

async function resolveCustomer(tx: ImportClient, raw: unknown, maps: ImportMaps, sheet: string, row: number): Promise<string> {
  const value = stringValue(raw);
  if (!value) return relationError('customerId', '', sheet, row);
  const byMap = maps.customersById.get(value) ?? maps.customersByPhone.get(value);
  if (byMap) return byMap;
  const customer = await tx.customer.findFirst({
    where: { OR: [{ id: value }, { phone: value }] },
    select: { id: true },
  });
  if (!customer) return relationError('customerId', value, sheet, row);
  return customer.id;
}

async function resolveSale(tx: ImportClient, raw: unknown, maps: ImportMaps, sheet: string, row: number): Promise<string> {
  const value = stringValue(raw);
  if (!value) return relationError('saleId', '', sheet, row);
  const byMap = maps.salesById.get(value) ?? maps.salesByInvoice.get(value);
  if (byMap) return byMap;
  const sale = await tx.sale.findFirst({
    where: { OR: [{ id: value }, { invoiceNumber: value }] },
    select: { id: true },
  });
  if (!sale) return relationError('saleId', value, sheet, row);
  return sale.id;
}

async function resolveShift(tx: ImportClient, raw: unknown, maps: ImportMaps, sheet: string, row: number): Promise<string> {
  const value = stringValue(raw);
  if (!value) return relationError('shiftId', '', sheet, row);
  const byMap = maps.shiftsById.get(value);
  if (byMap) return byMap;
  const shift = await tx.shift.findUnique({ where: { id: value }, select: { id: true } });
  if (!shift) return relationError('shiftId', value, sheet, row);
  return shift.id;
}

async function resolveExpense(tx: ImportClient, raw: unknown, maps: ImportMaps, sheet: string, row: number): Promise<string> {
  const value = stringValue(raw);
  if (!value) return relationError('expenseId', '', sheet, row);
  const byMap = maps.expensesById.get(value);
  if (byMap) return byMap;
  const expense = await tx.expense.findUnique({ where: { id: value }, select: { id: true } });
  if (!expense) return relationError('expenseId', value, sheet, row);
  return expense.id;
}

function optionalDecimal(value: number | null): number | null {
  return value === null ? null : value;
}

function signedMoneyValue(
  row: Record<string, unknown>,
  field: string,
  sheet: string,
  rowNumber: number,
  required = false
): number | null {
  return numberValue(row, field, sheet, rowNumber, required);
}

function assertEmail(value: string | null, field: string, sheet: string, rowNumber: number): string | null {
  if (value && (!/^\S+@\S+\.\S+$/.test(value) || value.length > 200)) {
    migrationError(field, 'email must be a valid address', sheet, rowNumber);
  }
  return value;
}

function assertMoneyBalance(
  subtotal: number,
  discountAmount: number,
  taxAmount: number,
  totalAmount: number,
  paidAmount: number,
  changeAmount: number,
  sheet: string,
  rowNumber: number
): void {
  if (discountAmount > subtotal) migrationError('discountAmount', 'discount cannot exceed subtotal', sheet, rowNumber);
  const expectedTotal = Math.round((subtotal - discountAmount + taxAmount) * 100) / 100;
  if (Math.abs(totalAmount - expectedTotal) > 0.01) {
    migrationError('totalAmount', 'totalAmount must equal subtotal - discountAmount + taxAmount', sheet, rowNumber);
  }
  if (changeAmount > paidAmount) migrationError('changeAmount', 'changeAmount cannot exceed paidAmount', sheet, rowNumber);
}

function passwordIsHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(value);
}

function track(map: Map<string, string>, input: string | null, actual: string): void {
  if (input) map.set(input, actual);
}

async function importUsers(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const name = boundedString(row, 'name', 'Users', rowNumber, 100, true) as string;
    const email = requiredString(row, 'email', 'Users', rowNumber).toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || email.length > 200) {
      migrationError('email', 'email must be a valid address', 'Users', rowNumber);
    }
    const password = boundedString(row, 'password', 'Users', rowNumber, 256);
    const existing = (id
      ? await tx.user.findUnique({ where: { id }, select: { id: true, password: true } })
      : null) ?? await tx.user.findUnique({ where: { email }, select: { id: true, password: true } });
    if (!existing && !password) {
      migrationError('password', 'password is required for a new user', 'Users', rowNumber);
    }
    if (password && !passwordIsHash(password) && !/^(?=.*[A-Za-z])(?=.*\d).{8,256}$/.test(password)) {
      migrationError('password', 'plain passwords must be 8-256 characters and contain a letter and number', 'Users', rowNumber);
    }
    if (password && passwordIsHash(password) && !/^\$2[aby]\$\d{2}\$[./A-Za-z0-9]{53}$/.test(password)) {
      migrationError('password', 'password hash is not a valid bcrypt hash', 'Users', rowNumber);
    }
    const hashedPassword = password
      ? (passwordIsHash(password) ? password : await bcrypt.hash(password, 10))
      : existing?.password;
    if (!hashedPassword) migrationError('password', 'password is required', 'Users', rowNumber);
    const data = {
      name,
      email,
      password: hashedPassword,
      role: enumValue(row, 'role', USER_ROLES, 'Users', rowNumber, 'CASHIER'),
      phone: boundedString(row, 'phone', 'Users', rowNumber, 20),
      isActive: booleanValue(row, 'isActive', 'Users', rowNumber, true),
      lastLoginAt: null,
      createdAt: dateValue(row, 'createdAt', 'Users', rowNumber) ?? new Date(),
      updatedAt: dateValue(row, 'updatedAt', 'Users', rowNumber) ?? new Date(),
    };
    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: { ...data, sessionVersion: { increment: 1 } },
        })
      : await tx.user.create({ data: id ? { id, ...data } : data });
    track(maps.usersById, id, user.id);
    maps.usersByEmail.set(email, user.id);
  }
  return rows.length;
}

async function importCategories(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const name = boundedString(row, 'name', 'Categories', rowNumber, 100, true) as string;
    const slug = boundedString(row, 'slug', 'Categories', rowNumber, 100, true) as string;
    const existing = (id
      ? await tx.category.findUnique({ where: { id }, select: { id: true } })
      : null) ?? await tx.category.findUnique({ where: { slug }, select: { id: true } });
    const data = {
      name,
      nameMm: boundedString(row, 'nameMm', 'Categories', rowNumber, 100),
      description: boundedString(row, 'description', 'Categories', rowNumber, 500),
      slug,
      isActive: booleanValue(row, 'isActive', 'Categories', rowNumber, true),
      createdAt: dateValue(row, 'createdAt', 'Categories', rowNumber) ?? new Date(),
    };
    const category = existing
      ? await tx.category.update({ where: { id: existing.id }, data })
      : await tx.category.create({ data: id ? { id, ...data } : data });
    track(maps.categoriesById, id, category.id);
    maps.categoriesBySlug.set(slug, category.id);
    maps.categoriesByName.set(name, category.id);
  }
  return rows.length;
}

async function importCustomers(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const name = boundedString(row, 'name', 'Customers', rowNumber, 200, true) as string;
    const phone = boundedString(row, 'phone', 'Customers', rowNumber, 20);
    const existing = (id
      ? await tx.customer.findUnique({ where: { id }, select: { id: true } })
      : null) ?? (phone
        ? await tx.customer.findUnique({ where: { phone }, select: { id: true } })
        : null);
    const data = {
      name,
      phone,
      email: assertEmail(boundedString(row, 'email', 'Customers', rowNumber, 200), 'email', 'Customers', rowNumber),
      address: boundedString(row, 'address', 'Customers', rowNumber, 500),
      totalPurchases: nonNegativeNumberValue(row, 'totalPurchases', 'Customers', rowNumber) ?? 0,
      loyaltyPoints: nonNegativeIntegerValue(row, 'loyaltyPoints', 'Customers', rowNumber) ?? 0,
      createdAt: dateValue(row, 'createdAt', 'Customers', rowNumber) ?? new Date(),
      updatedAt: dateValue(row, 'updatedAt', 'Customers', rowNumber) ?? new Date(),
    };
    const customer = existing
      ? await tx.customer.update({ where: { id: existing.id }, data })
      : await tx.customer.create({ data: id ? { id, ...data } : data });
    track(maps.customersById, id, customer.id);
    if (phone) maps.customersByPhone.set(phone, customer.id);
  }
  return rows.length;
}

async function importProducts(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const name = boundedString(row, 'name', 'Products', rowNumber, 200, true) as string;
    const sku = boundedString(row, 'sku', 'Products', rowNumber, 50, true) as string;
    const categoryId = await resolveCategory(tx, row.categoryId, maps, 'Products', rowNumber);
    const existing = (id
      ? await tx.product.findUnique({ where: { id }, select: { id: true } })
      : null) ?? await tx.product.findUnique({ where: { sku }, select: { id: true } });
    const data = {
      name,
      nameMm: boundedString(row, 'nameMm', 'Products', rowNumber, 200),
      sku,
      barcode: boundedString(row, 'barcode', 'Products', rowNumber, 50),
      categoryId,
      costPrice: nonNegativeNumberValue(row, 'costPrice', 'Products', rowNumber) ?? 0,
      sellingPrice: nonNegativeNumberValue(row, 'sellingPrice', 'Products', rowNumber) ?? 0,
      stockQuantity: nonNegativeIntegerValue(row, 'stockQuantity', 'Products', rowNumber) ?? 0,
      lowStockThreshold: nonNegativeIntegerValue(row, 'lowStockThreshold', 'Products', rowNumber) ?? 10,
      unit: enumValue(row, 'unit', PRODUCT_UNITS, 'Products', rowNumber, 'pcs'),
      imageUrl: boundedString(row, 'imageUrl', 'Products', rowNumber, 500),
      isActive: booleanValue(row, 'isActive', 'Products', rowNumber, true),
      createdAt: dateValue(row, 'createdAt', 'Products', rowNumber) ?? new Date(),
      updatedAt: dateValue(row, 'updatedAt', 'Products', rowNumber) ?? new Date(),
    };
    const product = existing
      ? await tx.product.update({ where: { id: existing.id }, data })
      : await tx.product.create({ data: id ? { id, ...data } : data });
    track(maps.productsById, id, product.id);
    maps.productsBySku.set(sku, product.id);
  }
  return rows.length;
}

async function importSales(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const invoiceNumber = boundedString(row, 'invoiceNumber', 'Sales', rowNumber, 50, true) as string;
    const userId = await resolveUser(tx, row.userId, maps, 'Sales', rowNumber);
    const rawCustomerId = stringValue(row.customerId);
    const customerId = rawCustomerId ? await resolveCustomer(tx, rawCustomerId, maps, 'Sales', rowNumber) : null;
    const clientSaleId = boundedString(row, 'clientSaleId', 'Sales', rowNumber, 100);
    const existing = (id
      ? await tx.sale.findUnique({ where: { id }, select: { id: true } })
      : null) ?? await tx.sale.findUnique({ where: { invoiceNumber }, select: { id: true } });
    const data = {
      invoiceNumber,
      clientSaleId,
      customerId,
      userId,
      subtotal: nonNegativeNumberValue(row, 'subtotal', 'Sales', rowNumber) ?? 0,
      discountAmount: nonNegativeNumberValue(row, 'discountAmount', 'Sales', rowNumber) ?? 0,
      taxAmount: nonNegativeNumberValue(row, 'taxAmount', 'Sales', rowNumber) ?? 0,
      totalAmount: nonNegativeNumberValue(row, 'totalAmount', 'Sales', rowNumber) ?? 0,
      paidAmount: nonNegativeNumberValue(row, 'paidAmount', 'Sales', rowNumber) ?? 0,
      changeAmount: nonNegativeNumberValue(row, 'changeAmount', 'Sales', rowNumber) ?? 0,
      paymentMethod: enumValue(row, 'paymentMethod', PAYMENT_METHODS, 'Sales', rowNumber, 'CASH'),
      paymentStatus: enumValue(row, 'paymentStatus', PAYMENT_STATUSES, 'Sales', rowNumber, 'PAID'),
      paymentReference: boundedString(row, 'paymentReference', 'Sales', rowNumber, 100),
      paymentProviderResponse: boundedString(row, 'paymentProviderResponse', 'Sales', rowNumber, 2000),
      status: enumValue(row, 'status', SALE_STATUSES, 'Sales', rowNumber, 'COMPLETED'),
      notes: boundedString(row, 'notes', 'Sales', rowNumber, 500),
      createdAt: dateValue(row, 'createdAt', 'Sales', rowNumber) ?? new Date(),
    };
    assertMoneyBalance(
      data.subtotal,
      data.discountAmount,
      data.taxAmount,
      data.totalAmount,
      data.paidAmount,
      data.changeAmount,
      'Sales',
      rowNumber
    );
    const sale = existing
      ? await tx.sale.update({ where: { id: existing.id }, data })
      : await tx.sale.create({ data: id ? { id, ...data } : data });
    track(maps.salesById, id, sale.id);
    maps.salesByInvoice.set(invoiceNumber, sale.id);
  }
  return rows.length;
}

async function importSaleItems(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const saleId = await resolveSale(tx, row.saleId, maps, 'SaleItems', rowNumber);
    const productId = await resolveProduct(tx, row.productId, maps, 'SaleItems', rowNumber);
    const quantity = positiveIntegerValue(row, 'quantity', 'SaleItems', rowNumber, true) as number;
    const data = {
      saleId,
      productId,
      quantity,
      unitPrice: nonNegativeNumberValue(row, 'unitPrice', 'SaleItems', rowNumber) ?? 0,
      costPrice: nonNegativeNumberValue(row, 'costPrice', 'SaleItems', rowNumber) ?? 0,
      discount: nonNegativeNumberValue(row, 'discount', 'SaleItems', rowNumber) ?? 0,
      total: nonNegativeNumberValue(row, 'total', 'SaleItems', rowNumber) ?? 0,
    };
    const expectedLineTotal = Math.round(Math.max(0, data.unitPrice * quantity - data.discount) * 100) / 100;
    if (Math.abs(data.total - expectedLineTotal) > 0.01) {
      migrationError('total', 'line total must equal unitPrice * quantity - discount', 'SaleItems', rowNumber);
    }
    if (id) {
      await tx.saleItem.upsert({ where: { id }, create: { id, ...data }, update: data });
    } else {
      await tx.saleItem.create({ data });
    }
  }
  return rows.length;
}

async function importStockMovements(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const productId = await resolveProduct(tx, row.productId, maps, 'StockMovements', rowNumber);
    const userId = await resolveUser(tx, row.userId, maps, 'StockMovements', rowNumber);
    const rawSaleId = stringValue(row.saleId);
    const saleId = rawSaleId ? await resolveSale(tx, rawSaleId, maps, 'StockMovements', rowNumber) : null;
    const data = {
      productId,
      userId,
      saleId,
      quantity: positiveIntegerValue(row, 'quantity', 'StockMovements', rowNumber, true) as number,
      type: enumValue(row, 'type', MOVEMENT_TYPES, 'StockMovements', rowNumber),
      reason: boundedString(row, 'reason', 'StockMovements', rowNumber, 500),
      previousStock: nonNegativeIntegerValue(row, 'previousStock', 'StockMovements', rowNumber, true) as number,
      newStock: nonNegativeIntegerValue(row, 'newStock', 'StockMovements', rowNumber, true) as number,
      createdAt: dateValue(row, 'createdAt', 'StockMovements', rowNumber) ?? new Date(),
    };
    if (data.type === 'IN' || data.type === 'RETURN') {
      if (data.newStock !== data.previousStock + data.quantity) {
        migrationError('newStock', 'IN/RETURN movement must increase stock by quantity', 'StockMovements', rowNumber);
      }
    } else if (data.type === 'OUT') {
      if (data.newStock !== data.previousStock - data.quantity) {
        migrationError('newStock', 'OUT movement must decrease stock by quantity', 'StockMovements', rowNumber);
      }
    } else if (data.newStock !== data.quantity) {
      migrationError('newStock', 'ADJUSTMENT quantity must equal newStock', 'StockMovements', rowNumber);
    }
    if (id) {
      await tx.stockMovement.upsert({ where: { id }, create: { id, ...data }, update: data });
    } else {
      await tx.stockMovement.create({ data });
    }
  }
  return rows.length;
}

async function importExpenses(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const userId = await resolveUser(tx, row.userId, maps, 'Expenses', rowNumber);
    const data = {
      category: boundedString(row, 'category', 'Expenses', rowNumber, 100, true) as string,
      amount: positiveNumberValue(row, 'amount', 'Expenses', rowNumber, true) as number,
      description: boundedString(row, 'description', 'Expenses', rowNumber, 500),
      userId,
      date: dateValue(row, 'date', 'Expenses', rowNumber) ?? new Date(),
      createdAt: dateValue(row, 'createdAt', 'Expenses', rowNumber) ?? new Date(),
    };
    if (id) {
      await tx.expense.upsert({ where: { id }, create: { id, ...data }, update: data });
      maps.expensesById.set(id, id);
    } else {
      const expense = await tx.expense.create({ data });
      maps.expensesById.set(expense.id, expense.id);
    }
  }
  return rows.length;
}

async function importShifts(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const userId = await resolveUser(tx, row.userId, maps, 'Shifts', rowNumber);
    const status = enumValue(row, 'status', SHIFT_STATUSES, 'Shifts', rowNumber);
    const closedAt = dateValue(row, 'closedAt', 'Shifts', rowNumber);
    if (status === 'OPEN' && closedAt) migrationError('closedAt', 'an OPEN shift cannot have closedAt', 'Shifts', rowNumber);
    if (status === 'CLOSED' && !closedAt) migrationError('closedAt', 'a CLOSED shift must have closedAt', 'Shifts', rowNumber);
    const data = {
      userId,
      openingCash: nonNegativeNumberValue(row, 'openingCash', 'Shifts', rowNumber, true) as number,
      closingCash: optionalDecimal(nonNegativeNumberValue(row, 'closingCash', 'Shifts', rowNumber)),
      expectedCash: optionalDecimal(nonNegativeNumberValue(row, 'expectedCash', 'Shifts', rowNumber)),
      actualCash: optionalDecimal(nonNegativeNumberValue(row, 'actualCash', 'Shifts', rowNumber)),
      variance: optionalDecimal(signedMoneyValue(row, 'variance', 'Shifts', rowNumber)),
      openedAt: dateValue(row, 'openedAt', 'Shifts', rowNumber, true) as Date,
      closedAt,
      notes: boundedString(row, 'notes', 'Shifts', rowNumber, 500),
    };
    if (id) {
      await tx.shift.upsert({ where: { id }, create: { id, ...data }, update: data });
      maps.shiftsById.set(id, id);
    } else {
      const shift = await tx.shift.create({ data });
      maps.shiftsById.set(shift.id, shift.id);
    }
  }
  return rows.length;
}

async function importSaleAdjustments(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
      const id = inputId(row);
      const data = {
        saleId: await resolveSale(tx, row.saleId, maps, 'SaleAdjustments', rowNumber),
        approverUserId: await resolveUser(tx, row.approverUserId, maps, 'SaleAdjustments', rowNumber),
        type: enumValue(row, 'type', ADJUSTMENT_TYPES, 'SaleAdjustments', rowNumber),
        reason: boundedString(row, 'reason', 'SaleAdjustments', rowNumber, 500, true) as string,
        amount: positiveNumberValue(row, 'amount', 'SaleAdjustments', rowNumber, true) as number,
        paymentMethod: enumValue(row, 'paymentMethod', PAYMENT_METHODS, 'SaleAdjustments', rowNumber),
        paymentReversalStatus: enumValue(row, 'paymentReversalStatus', REVERSAL_STATUSES, 'SaleAdjustments', rowNumber, 'PENDING'),
        createdAt: dateValue(row, 'createdAt', 'SaleAdjustments', rowNumber) ?? new Date(),
      };
    if (id) {
      await tx.saleAdjustment.upsert({ where: { id }, create: { id, ...data }, update: data });
    } else {
      await tx.saleAdjustment.create({ data });
    }
  }
  return rows.length;
}

async function importCashDrawerMovements(tx: ImportClient, rows: Record<string, unknown>[], maps: ImportMaps): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = inputId(row);
    const rawShiftId = stringValue(row.shiftId);
    const rawSaleId = stringValue(row.saleId);
    const rawExpenseId = stringValue(row.expenseId);
    const shiftId = rawShiftId ? await resolveShift(tx, rawShiftId, maps, 'CashDrawerMovements', rowNumber) : null;
    const saleId = rawSaleId ? await resolveSale(tx, rawSaleId, maps, 'CashDrawerMovements', rowNumber) : null;
    const expenseId = rawExpenseId ? await resolveExpense(tx, rawExpenseId, maps, 'CashDrawerMovements', rowNumber) : null;
      const data = {
      shiftId,
      saleId,
        expenseId,
        userId: await resolveUser(tx, row.userId, maps, 'CashDrawerMovements', rowNumber),
        type: enumValue(row, 'type', CASH_MOVEMENT_TYPES, 'CashDrawerMovements', rowNumber),
        amount: signedMoneyValue(row, 'amount', 'CashDrawerMovements', rowNumber, true) as number,
        reason: boundedString(row, 'reason', 'CashDrawerMovements', rowNumber, 500),
        createdAt: dateValue(row, 'createdAt', 'CashDrawerMovements', rowNumber) ?? new Date(),
      };
      if (!shiftId) migrationError('shiftId', 'cash drawer movements must belong to a shift', 'CashDrawerMovements', rowNumber);
      if (data.type === 'CASH_SALE' && !saleId) migrationError('saleId', 'CASH_SALE movement must reference a sale', 'CashDrawerMovements', rowNumber);
      if ((data.type === 'REFUND' || data.type === 'VOID') && !saleId) migrationError('saleId', `${data.type} movement must reference a sale`, 'CashDrawerMovements', rowNumber);
      if ((data.type === 'REFUND' || data.type === 'VOID') && data.amount >= 0) migrationError('amount', `${data.type} movement amount must be negative`, 'CashDrawerMovements', rowNumber);
      if (data.type !== 'REFUND' && data.type !== 'VOID' && data.amount <= 0) migrationError('amount', `${data.type} movement amount must be positive`, 'CashDrawerMovements', rowNumber);
      if (data.type === 'PAID_OUT' && !expenseId && !data.reason) migrationError('reason', 'PAID_OUT movement needs an expense or reason', 'CashDrawerMovements', rowNumber);
    if (id) {
      await tx.cashDrawerMovement.upsert({ where: { id }, create: { id, ...data }, update: data });
    } else {
      await tx.cashDrawerMovement.create({ data });
    }
  }
  return rows.length;
}

async function importSettings(tx: ImportClient, rows: Record<string, unknown>[]): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const id = boundedString(row, 'id', 'Settings', rowNumber, 100) || 'default';
    const data = {
      businessName: boundedString(row, 'businessName', 'Settings', rowNumber, 200, true) as string,
      businessNameMm: boundedString(row, 'businessNameMm', 'Settings', rowNumber, 200),
      address: boundedString(row, 'address', 'Settings', rowNumber, 500),
      phone: boundedString(row, 'phone', 'Settings', rowNumber, 20),
      email: assertEmail(boundedString(row, 'email', 'Settings', rowNumber, 200), 'email', 'Settings', rowNumber),
      taxRate: nonNegativeNumberValue(row, 'taxRate', 'Settings', rowNumber, true) as number,
      currencySymbol: boundedString(row, 'currencySymbol', 'Settings', rowNumber, 10, true) as string,
      logo: boundedString(row, 'logo', 'Settings', rowNumber, 1000),
      receiptFooter: boundedString(row, 'receiptFooter', 'Settings', rowNumber, 500),
    };
    if (data.taxRate > 100) migrationError('taxRate', 'taxRate cannot exceed 100', 'Settings', rowNumber);
    await tx.settings.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  return rows.length;
}

async function importInvoiceCounters(tx: ImportClient, rows: Record<string, unknown>[]): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const date = requiredString(row, 'date', 'InvoiceCounters', rowNumber);
    if (!/^\d{8}$/.test(date)) migrationError('date', 'date must use YYYYMMDD format', 'InvoiceCounters', rowNumber);
    const counter = nonNegativeIntegerValue(row, 'counter', 'InvoiceCounters', rowNumber, true) as number;
    await tx.invoiceCounter.upsert({ where: { date }, create: { date, counter }, update: { counter } });
  }
  return rows.length;
}

export async function importDataMigration(
  prisma: PrismaClient,
  rows: MigrationRows
): Promise<Record<string, number>> {
  const run = async (tx: Prisma.TransactionClient): Promise<Record<string, number>> => {
    const maps = createImportMaps();
    const summary: Record<string, number> = {};
    if (rows.Users) summary.Users = await importUsers(tx, rows.Users, maps);
    if (rows.Categories) summary.Categories = await importCategories(tx, rows.Categories, maps);
    if (rows.Customers) summary.Customers = await importCustomers(tx, rows.Customers, maps);
    if (rows.Products) summary.Products = await importProducts(tx, rows.Products, maps);
    if (rows.Sales) summary.Sales = await importSales(tx, rows.Sales, maps);
    if (rows.SaleItems) summary.SaleItems = await importSaleItems(tx, rows.SaleItems, maps);
    if (rows.StockMovements) summary.StockMovements = await importStockMovements(tx, rows.StockMovements, maps);
    if (rows.Expenses) summary.Expenses = await importExpenses(tx, rows.Expenses, maps);
    if (rows.Shifts) summary.Shifts = await importShifts(tx, rows.Shifts, maps);
    if (rows.SaleAdjustments) summary.SaleAdjustments = await importSaleAdjustments(tx, rows.SaleAdjustments, maps);
    if (rows.CashDrawerMovements) summary.CashDrawerMovements = await importCashDrawerMovements(tx, rows.CashDrawerMovements, maps);
    if (rows.Settings) summary.Settings = await importSettings(tx, rows.Settings);
    if (rows.InvoiceCounters) summary.InvoiceCounters = await importInvoiceCounters(tx, rows.InvoiceCounters);
    return summary;
  };

  return prisma.$transaction(run, { maxWait: 10_000, timeout: 120_000 });
}
