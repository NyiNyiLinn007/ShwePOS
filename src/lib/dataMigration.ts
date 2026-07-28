import * as XLSX from 'xlsx';
import bcrypt from 'bcryptjs';
import type { Prisma, PrismaClient } from '@prisma/client';

export const DATA_MIGRATION_SHEETS = {
  Users: {
    headers: ['id', 'name', 'email', 'password', 'role', 'phone', 'isActive', 'sessionVersion', 'lastLoginAt', 'createdAt', 'updatedAt'],
    required: ['name', 'email', 'password'],
    description: 'System users. Keep password as a bcrypt hash when migrating existing users, or enter a plain password for a new user.',
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

function isBlank(value: unknown): boolean {
  return value === null || value === undefined || (typeof value === 'string' && value.trim() === '');
}

function stringValue(value: unknown): string | null {
  if (isBlank(value)) return null;
  return String(value).trim();
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

function workbookRows(workbook: XLSX.WorkBook): MigrationRows {
  const knownNames = new Set<string>(Object.keys(DATA_MIGRATION_SHEETS));
  const unknownSheets = workbook.SheetNames.filter(
    (name) => name !== INSTRUCTIONS_SHEET && !knownNames.has(name)
  );
  if (unknownSheets.length > 0) {
    throw new DataMigrationError(`Unsupported sheet(s): ${unknownSheets.join(', ')}`);
  }

  const result: MigrationRows = {};
  let totalRows = 0;

  for (const sheetName of workbook.SheetNames) {
    if (sheetName === INSTRUCTIONS_SHEET) continue;
    const definition = DATA_MIGRATION_SHEETS[sheetName as MigrationSheetName];
    const sheet = workbook.Sheets[sheetName];
    const matrix = XLSX.utils.sheet_to_json<unknown[]>(sheet, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });

    if (matrix.length === 0) continue;
    const headerRow = (matrix[0] ?? []).map((value) => String(value ?? '').trim().replace(/^\uFEFF/, ''));
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

export function parseDataMigrationWorkbook(buffer: Buffer): MigrationRows {
  try {
    const workbook = XLSX.read(buffer, { type: 'buffer', cellDates: true, cellNF: false });
    return workbookRows(workbook);
  } catch (error) {
    if (error instanceof DataMigrationError) throw error;
    throw new DataMigrationError('The uploaded file is not a readable Excel workbook');
  }
}

function exportValue(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object' && 'toNumber' in value && typeof (value as { toNumber?: unknown }).toNumber === 'function') {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  return String(value);
}

function rowsForSheet(rows: unknown[], headers: readonly string[]): Array<Array<string | number | boolean | null>> {
  return rows.map((row) => headers.map((header) => exportValue((row as Record<string, unknown>)[header])));
}

export function createDataMigrationWorkbook(data: MigrationRows = {}): XLSX.WorkBook {
  const workbook = XLSX.utils.book_new();
  const instructions = [
    ['ShwePOS Data Migration Workbook'],
    ['How to use'],
    ['1. For a new migration, download the template, fill the data sheets, and keep the column names unchanged.'],
    ['2. For a complete backup/migration, use Export All Data and import that workbook into another ShwePOS database.'],
    ['3. Blank id cells are allowed for new records. Existing ids can be kept to update/migrate the same records.'],
    ['4. Relation fields accept ids and selected natural keys (category slug/name, product SKU, invoice number, user email).'],
    ['5. Import is additive/upsert. It does not delete records that are not included in the workbook.'],
    ['6. Users: password can be a normal password for a new user or an existing bcrypt hash from an export.'],
    ['7. Do not share exported workbooks because the Users sheet contains password hashes.'],
    [],
    ['Sheet', 'Required fields', 'Notes'],
    ...Object.entries(DATA_MIGRATION_SHEETS).map(([name, definition]) => [
      name,
      definition.required.join(', '),
      definition.description,
    ]),
  ];
  const instructionSheet = XLSX.utils.aoa_to_sheet(instructions);
  instructionSheet['!cols'] = [{ wch: 24 }, { wch: 42 }, { wch: 110 }];
  XLSX.utils.book_append_sheet(workbook, instructionSheet, INSTRUCTIONS_SHEET);

  for (const [sheetName, definition] of Object.entries(DATA_MIGRATION_SHEETS)) {
    const rows = data[sheetName as MigrationSheetName] ?? [];
    const sheet = XLSX.utils.aoa_to_sheet([
      [...definition.headers],
      ...rowsForSheet(rows, definition.headers),
    ]);
    sheet['!cols'] = definition.headers.map((header) => ({
      wch: Math.min(34, Math.max(14, header.length + 3)),
    }));
    XLSX.utils.book_append_sheet(workbook, sheet, sheetName);
  }

  return workbook;
}

export function workbookBuffer(workbook: XLSX.WorkBook): Buffer {
  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx', compression: true }) as Buffer;
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
    const name = requiredString(row, 'name', 'Users', rowNumber);
    const email = requiredString(row, 'email', 'Users', rowNumber).toLowerCase();
    const password = requiredString(row, 'password', 'Users', rowNumber);
    const existing = (id
      ? await tx.user.findUnique({ where: { id }, select: { id: true } })
      : null) ?? await tx.user.findUnique({ where: { email }, select: { id: true } });
    const hashedPassword = passwordIsHash(password) ? password : await bcrypt.hash(password, 10);
    const data = {
      name,
      email,
      password: hashedPassword,
      role: nullableString(row, 'role') || 'CASHIER',
      phone: nullableString(row, 'phone'),
      isActive: booleanValue(row, 'isActive', 'Users', rowNumber, true),
      sessionVersion: integerValue(row, 'sessionVersion', 'Users', rowNumber) ?? 0,
      lastLoginAt: dateValue(row, 'lastLoginAt', 'Users', rowNumber),
      createdAt: dateValue(row, 'createdAt', 'Users', rowNumber) ?? new Date(),
      updatedAt: dateValue(row, 'updatedAt', 'Users', rowNumber) ?? new Date(),
    };
    const user = existing
      ? await tx.user.update({ where: { id: existing.id }, data })
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
    const name = requiredString(row, 'name', 'Categories', rowNumber);
    const slug = requiredString(row, 'slug', 'Categories', rowNumber);
    const existing = (id
      ? await tx.category.findUnique({ where: { id }, select: { id: true } })
      : null) ?? await tx.category.findUnique({ where: { slug }, select: { id: true } });
    const data = {
      name,
      nameMm: nullableString(row, 'nameMm'),
      description: nullableString(row, 'description'),
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
    const name = requiredString(row, 'name', 'Customers', rowNumber);
    const phone = nullableString(row, 'phone');
    const existing = (id
      ? await tx.customer.findUnique({ where: { id }, select: { id: true } })
      : null) ?? (phone
        ? await tx.customer.findUnique({ where: { phone }, select: { id: true } })
        : null);
    const data = {
      name,
      phone,
      email: nullableString(row, 'email'),
      address: nullableString(row, 'address'),
      totalPurchases: numberValue(row, 'totalPurchases', 'Customers', rowNumber) ?? 0,
      loyaltyPoints: integerValue(row, 'loyaltyPoints', 'Customers', rowNumber) ?? 0,
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
    const name = requiredString(row, 'name', 'Products', rowNumber);
    const sku = requiredString(row, 'sku', 'Products', rowNumber);
    const categoryId = await resolveCategory(tx, row.categoryId, maps, 'Products', rowNumber);
    const existing = (id
      ? await tx.product.findUnique({ where: { id }, select: { id: true } })
      : null) ?? await tx.product.findUnique({ where: { sku }, select: { id: true } });
    const data = {
      name,
      nameMm: nullableString(row, 'nameMm'),
      sku,
      barcode: nullableString(row, 'barcode'),
      categoryId,
      costPrice: numberValue(row, 'costPrice', 'Products', rowNumber) ?? 0,
      sellingPrice: numberValue(row, 'sellingPrice', 'Products', rowNumber) ?? 0,
      stockQuantity: integerValue(row, 'stockQuantity', 'Products', rowNumber) ?? 0,
      lowStockThreshold: integerValue(row, 'lowStockThreshold', 'Products', rowNumber) ?? 10,
      unit: nullableString(row, 'unit') || 'pcs',
      imageUrl: nullableString(row, 'imageUrl'),
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
    const invoiceNumber = requiredString(row, 'invoiceNumber', 'Sales', rowNumber);
    const userId = await resolveUser(tx, row.userId, maps, 'Sales', rowNumber);
    const rawCustomerId = stringValue(row.customerId);
    const customerId = rawCustomerId ? await resolveCustomer(tx, rawCustomerId, maps, 'Sales', rowNumber) : null;
    const clientSaleId = nullableString(row, 'clientSaleId');
    const existing = (id
      ? await tx.sale.findUnique({ where: { id }, select: { id: true } })
      : null) ?? await tx.sale.findUnique({ where: { invoiceNumber }, select: { id: true } });
    const data = {
      invoiceNumber,
      clientSaleId,
      customerId,
      userId,
      subtotal: numberValue(row, 'subtotal', 'Sales', rowNumber) ?? 0,
      discountAmount: numberValue(row, 'discountAmount', 'Sales', rowNumber) ?? 0,
      taxAmount: numberValue(row, 'taxAmount', 'Sales', rowNumber) ?? 0,
      totalAmount: numberValue(row, 'totalAmount', 'Sales', rowNumber) ?? 0,
      paidAmount: numberValue(row, 'paidAmount', 'Sales', rowNumber) ?? 0,
      changeAmount: numberValue(row, 'changeAmount', 'Sales', rowNumber) ?? 0,
      paymentMethod: nullableString(row, 'paymentMethod') || 'CASH',
      paymentStatus: nullableString(row, 'paymentStatus') || 'PAID',
      paymentReference: nullableString(row, 'paymentReference'),
      paymentProviderResponse: nullableString(row, 'paymentProviderResponse'),
      status: nullableString(row, 'status') || 'COMPLETED',
      notes: nullableString(row, 'notes'),
      createdAt: dateValue(row, 'createdAt', 'Sales', rowNumber) ?? new Date(),
    };
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
    const quantity = integerValue(row, 'quantity', 'SaleItems', rowNumber, true) as number;
    const data = {
      saleId,
      productId,
      quantity,
      unitPrice: numberValue(row, 'unitPrice', 'SaleItems', rowNumber) ?? 0,
      costPrice: numberValue(row, 'costPrice', 'SaleItems', rowNumber) ?? 0,
      discount: numberValue(row, 'discount', 'SaleItems', rowNumber) ?? 0,
      total: numberValue(row, 'total', 'SaleItems', rowNumber) ?? 0,
    };
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
      quantity: integerValue(row, 'quantity', 'StockMovements', rowNumber, true) as number,
      type: requiredString(row, 'type', 'StockMovements', rowNumber),
      reason: nullableString(row, 'reason'),
      previousStock: integerValue(row, 'previousStock', 'StockMovements', rowNumber, true) as number,
      newStock: integerValue(row, 'newStock', 'StockMovements', rowNumber, true) as number,
      createdAt: dateValue(row, 'createdAt', 'StockMovements', rowNumber) ?? new Date(),
    };
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
      category: requiredString(row, 'category', 'Expenses', rowNumber),
      amount: numberValue(row, 'amount', 'Expenses', rowNumber, true) as number,
      description: nullableString(row, 'description'),
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
    const data = {
      userId,
      openingCash: numberValue(row, 'openingCash', 'Shifts', rowNumber, true) as number,
      closingCash: optionalDecimal(numberValue(row, 'closingCash', 'Shifts', rowNumber)),
      expectedCash: optionalDecimal(numberValue(row, 'expectedCash', 'Shifts', rowNumber)),
      actualCash: optionalDecimal(numberValue(row, 'actualCash', 'Shifts', rowNumber)),
      variance: optionalDecimal(numberValue(row, 'variance', 'Shifts', rowNumber)),
      status: requiredString(row, 'status', 'Shifts', rowNumber),
      openedAt: dateValue(row, 'openedAt', 'Shifts', rowNumber, true) as Date,
      closedAt: dateValue(row, 'closedAt', 'Shifts', rowNumber),
      notes: nullableString(row, 'notes'),
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
      type: requiredString(row, 'type', 'SaleAdjustments', rowNumber),
      reason: requiredString(row, 'reason', 'SaleAdjustments', rowNumber),
      amount: numberValue(row, 'amount', 'SaleAdjustments', rowNumber, true) as number,
      paymentMethod: requiredString(row, 'paymentMethod', 'SaleAdjustments', rowNumber),
      paymentReversalStatus: nullableString(row, 'paymentReversalStatus') || 'PENDING',
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
      type: requiredString(row, 'type', 'CashDrawerMovements', rowNumber),
      amount: numberValue(row, 'amount', 'CashDrawerMovements', rowNumber, true) as number,
      reason: nullableString(row, 'reason'),
      createdAt: dateValue(row, 'createdAt', 'CashDrawerMovements', rowNumber) ?? new Date(),
    };
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
    const id = nullableString(row, 'id') || 'default';
    const data = {
      businessName: requiredString(row, 'businessName', 'Settings', rowNumber),
      businessNameMm: nullableString(row, 'businessNameMm'),
      address: nullableString(row, 'address'),
      phone: nullableString(row, 'phone'),
      email: nullableString(row, 'email'),
      taxRate: numberValue(row, 'taxRate', 'Settings', rowNumber, true) as number,
      currencySymbol: requiredString(row, 'currencySymbol', 'Settings', rowNumber),
      logo: nullableString(row, 'logo'),
      receiptFooter: nullableString(row, 'receiptFooter'),
    };
    await tx.settings.upsert({ where: { id }, create: { id, ...data }, update: data });
  }
  return rows.length;
}

async function importInvoiceCounters(tx: ImportClient, rows: Record<string, unknown>[]): Promise<number> {
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const date = requiredString(row, 'date', 'InvoiceCounters', rowNumber);
    const counter = integerValue(row, 'counter', 'InvoiceCounters', rowNumber, true) as number;
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
