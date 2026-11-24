import writeXlsxFile, {
  type Cell,
  type CellObject,
  type Row,
  type SheetData,
} from 'write-excel-file/node';
import { formatDateTime } from '@/lib/utils';
import {
  DATA_MIGRATION_SHEETS,
  ENUM_REFERENCE_ROWS,
  INSTRUCTIONS_SHEET,
  type MigrationColumnKind,
  type MigrationRows,
  type MigrationSheetDefinition,
  type MigrationSheetName,
} from '@/lib/dataMigrationSchema';

export type MigrationWorkbook = Array<{
  data: SheetData;
  sheet: string;
  columns: Array<{ width: number }>;
  stickyRowsCount?: number;
  orientation?: 'landscape';
  dateFormat?: string;
}>;

/** Placeholder written when a base64 image exceeds Excel's 32,767-char per-cell limit. */
export const MEDIA_OMITTED_MARKER = '[MEDIA_OMITTED_OVER_32K]';
const EXCEL_SAFE_MAX_CHARS = 32_000;

// ShwePOS Enterprise Slate + Warm Amber Excel Palette
const PALETTE = {
  bannerBg: '#0F172A', // Slate 900
  bannerText: '#FFFFFF',
  subBannerBg: '#FEF3C7', // Amber 100
  subBannerText: '#92400E', // Amber 800
  sectionBg: '#E2E8F0', // Slate 200
  sectionText: '#0F172A',
  headerOptionalBg: '#1E293B', // Slate 800
  headerRequiredBg: '#B45309', // Amber 700
  headerText: '#FFFFFF',
  headerBorder: '#0F172A',
  headerReqBorder: '#78350F',
  zebraEvenBg: '#FFFFFF',
  zebraOddBg: '#F8FAFC', // Slate 50
  cellBorder: '#CBD5E1', // Slate 300
  textPrimary: '#0F172A',
  textMuted: '#64748B',
  successBg: '#DCFCE7',
  successText: '#166534',
  warningBg: '#FEF3C7',
  warningText: '#92400E',
  dangerBg: '#FEE2E2',
  dangerText: '#991B1B',
  neutralBg: '#E2E8F0',
  neutralText: '#334155',
} as const;

function sanitizeFormulaText(text: string): string {
  // Prevent spreadsheet formula injection when user-supplied text starts with =, +, -, @
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function unwrapPrimitive(value: unknown): string | number | boolean | Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (
    typeof value === 'object' &&
    'toNumber' in value &&
    typeof (value as { toNumber?: unknown }).toNumber === 'function'
  ) {
    return (value as { toNumber: () => number }).toNumber();
  }
  if (typeof value === 'number' || typeof value === 'boolean') return value;
  if (typeof value === 'string') return value;
  return String(value);
}

function getStatusColors(value: string): { bg: string; text: string } | null {
  const upper = value.toUpperCase();
  if (['COMPLETED', 'RECEIVED', 'PAID', 'OPEN'].includes(upper)) {
    return { bg: PALETTE.successBg, text: PALETTE.successText };
  }
  if (['PARTIALLY_REFUNDED', 'REFUNDED', 'PARTIAL', 'PENDING'].includes(upper)) {
    return { bg: PALETTE.warningBg, text: PALETTE.warningText };
  }
  if (['VOIDED', 'CANCELLED', 'FAILED', 'REVERSED'].includes(upper)) {
    return { bg: PALETTE.dangerBg, text: PALETTE.dangerText };
  }
  if (upper === 'CLOSED' || upper === 'NOT_REQUIRED') {
    return { bg: PALETTE.neutralBg, text: PALETTE.neutralText };
  }
  return null;
}

function buildStyledDataCell(
  raw: unknown,
  kind: MigrationColumnKind,
  rowIndex: number
): CellObject {
  const baseBg = rowIndex % 2 === 1 ? PALETTE.zebraOddBg : PALETTE.zebraEvenBg;
  const baseStyle: CellObject = {
    backgroundColor: baseBg,
    borderColor: PALETTE.cellBorder,
    borderStyle: 'thin',
    alignVertical: 'center',
    height: 20,
  };

  const val = unwrapPrimitive(raw);
  if (val === null || val === '') {
    return {
      ...baseStyle,
      textColor: PALETTE.textMuted,
    };
  }

  // Date & DateTime columns -> native Excel Date cells when valid
  if (kind === 'date' || kind === 'datetime') {
    const parsedDate = val instanceof Date ? val : new Date(String(val));
    if (!Number.isNaN(parsedDate.getTime())) {
      return {
        ...baseStyle,
        value: parsedDate,
        type: Date,
        format: kind === 'date' ? 'yyyy-mm-dd' : 'yyyy-mm-dd hh:mm:ss',
        align: 'center',
        textColor: PALETTE.textPrimary,
      };
    }
  }

  // Boolean columns
  if (kind === 'bool' && typeof val === 'boolean') {
    return {
      ...baseStyle,
      value: val,
      type: Boolean,
      align: 'center',
      fontWeight: val ? 'bold' : undefined,
      textColor: val ? PALETTE.successText : PALETTE.textMuted,
    };
  }

  // Numeric columns (money, qty, int, percent)
  if (
    (kind === 'money' || kind === 'qty' || kind === 'int' || kind === 'percent') &&
    typeof val === 'number' &&
    Number.isFinite(val)
  ) {
    let numFormat = '#,##0';
    if (kind === 'money') {
      numFormat = Number.isInteger(val) ? '#,##0' : '#,##0.00';
    } else if (kind === 'qty') {
      numFormat = Number.isInteger(val) ? '#,##0' : '#,##0.000';
    } else if (kind === 'percent') {
      numFormat = Number.isInteger(val) ? '0' : '0.00';
    }
    return {
      ...baseStyle,
      value: val,
      type: Number,
      format: numFormat,
      align: 'right',
      textColor: val < 0 ? PALETTE.dangerText : PALETTE.textPrimary,
    };
  }

  // String & code columns
  const strVal = sanitizeFormulaText(
    val instanceof Date ? val.toISOString() : String(val)
  );

  if (kind === 'status') {
    const pill = getStatusColors(strVal);
    return {
      ...baseStyle,
      value: strVal,
      type: String,
      align: 'center',
      fontWeight: 'bold',
      backgroundColor: pill?.bg ?? baseBg,
      textColor: pill?.text ?? PALETTE.textPrimary,
    };
  }

  if (kind === 'enum') {
    return {
      ...baseStyle,
      value: strVal,
      type: String,
      align: 'center',
      textColor: PALETTE.textPrimary,
    };
  }

  if (kind === 'id') {
    return {
      ...baseStyle,
      value: strVal,
      type: String,
      format: '@',
      align: 'left',
      fontSize: 9,
      textColor: PALETTE.textMuted,
    };
  }

  if (kind === 'code') {
    // Explicit '@' Text format prevents Excel from stripping leading zeros (09...)
    // or converting 13-digit EAN barcodes into scientific notation (8.85E+12).
    return {
      ...baseStyle,
      value: strVal.slice(0, EXCEL_SAFE_MAX_CHARS),
      type: String,
      format: '@',
      align: 'left',
      textColor: PALETTE.textPrimary,
    };
  }

  const safeStrVal =
    strVal.length > EXCEL_SAFE_MAX_CHARS
      ? kind === 'media'
        ? MEDIA_OMITTED_MARKER
        : strVal.slice(0, EXCEL_SAFE_MAX_CHARS)
      : strVal;

  return {
    ...baseStyle,
    value: safeStrVal,
    type: String,
    align: 'left',
    textColor: kind === 'media' || kind === 'secret' ? PALETTE.textMuted : PALETTE.textPrimary,
  };
}

function buildHeaderRow(definition: MigrationSheetDefinition): Row {
  const requiredSet = new Set(definition.required);
  return definition.headers.map((header): CellObject => {
    const isRequired = requiredSet.has(header);
    const kind = definition.columns[header]?.kind ?? 'text';
    const align =
      kind === 'money' || kind === 'qty' || kind === 'int' || kind === 'percent'
        ? 'right'
        : kind === 'bool' || kind === 'enum' || kind === 'status' || kind === 'date' || kind === 'datetime'
          ? 'center'
          : 'left';

    return {
      value: header,
      type: String,
      fontWeight: 'bold',
      fontSize: 10.5,
      textColor: PALETTE.headerText,
      backgroundColor: isRequired ? PALETTE.headerRequiredBg : PALETTE.headerOptionalBg,
      align,
      alignVertical: 'center',
      height: 28,
      borderColor: isRequired ? PALETTE.headerReqBorder : PALETTE.headerBorder,
      borderStyle: 'thin',
      bottomBorderColor: isRequired ? PALETTE.headerReqBorder : PALETTE.headerBorder,
      bottomBorderStyle: 'medium',
    };
  });
}

function computeColumnWidths(
  definition: MigrationSheetDefinition,
  rows: Record<string, unknown>[]
): Array<{ width: number }> {
  return definition.headers.map((header) => {
    const spec = definition.columns[header];
    const baseWidth = spec?.width ?? Math.max(14, header.length + 4);
    if (spec?.kind === 'media' || spec?.kind === 'secret') {
      return { width: baseWidth };
    }
    let maxLen = Math.max(header.length + 3, baseWidth);
    const sampleCount = Math.min(rows.length, 200);
    for (let i = 0; i < sampleCount; i += 1) {
      const v = unwrapPrimitive(rows[i]?.[header]);
      if (v === null) continue;
      const len = v instanceof Date ? 20 : String(v).length + 2;
      if (len > maxLen) maxLen = len;
    }
    return { width: Math.min(40, Math.max(12, maxLen)) };
  });
}

function buildInstructionsSheet(data: MigrationRows): MigrationWorkbook[number] {
  const sheetEntries = Object.entries(DATA_MIGRATION_SHEETS) as Array<
    [MigrationSheetName, MigrationSheetDefinition]
  >;
  const totalRecords = sheetEntries.reduce(
    (sum, [name]) => sum + (data[name]?.length ?? 0),
    0
  );
  const isExport = totalRecords > 0;
  const generatedAtMm = formatDateTime(new Date());

  const makeSectionHeader = (title: string): Row => [
    {
      value: title,
      type: String,
      columnSpan: 6,
      fontWeight: 'bold',
      fontSize: 11,
      backgroundColor: PALETTE.sectionBg,
      textColor: PALETTE.sectionText,
      alignVertical: 'center',
      height: 24,
      borderColor: PALETTE.cellBorder,
      borderStyle: 'thin',
    },
    null,
    null,
    null,
    null,
    null,
  ];

  const makeMetaRow = (
    label1: string,
    val1: string | number,
    label2: string,
    val2: string,
    val2Bg?: string,
    val2Color?: string
  ): Row => [
    {
      value: label1,
      type: String,
      columnSpan: 2,
      fontWeight: 'bold',
      backgroundColor: PALETTE.zebraOddBg,
      textColor: PALETTE.textMuted,
      borderColor: PALETTE.cellBorder,
      borderStyle: 'thin',
      alignVertical: 'center',
      height: 22,
    },
    null,
    {
      value: val1,
      type: typeof val1 === 'number' ? Number : String,
      format: typeof val1 === 'number' ? '#,##0' : undefined,
      fontWeight: 'bold',
      backgroundColor: PALETTE.zebraEvenBg,
      textColor: PALETTE.textPrimary,
      borderColor: PALETTE.cellBorder,
      borderStyle: 'thin',
      align: typeof val1 === 'number' ? 'right' : 'left',
      alignVertical: 'center',
    },
    {
      value: label2,
      type: String,
      fontWeight: 'bold',
      backgroundColor: PALETTE.zebraOddBg,
      textColor: PALETTE.textMuted,
      borderColor: PALETTE.cellBorder,
      borderStyle: 'thin',
      alignVertical: 'center',
    },
    {
      value: val2,
      type: String,
      columnSpan: 2,
      fontWeight: val2Bg ? 'bold' : undefined,
      backgroundColor: val2Bg ?? PALETTE.zebraEvenBg,
      textColor: val2Color ?? PALETTE.textPrimary,
      borderColor: PALETTE.cellBorder,
      borderStyle: 'thin',
      alignVertical: 'center',
    },
    null,
  ];

  const guideItems: Array<[string, string, string]> = [
    [
      '1',
      'Do not rename sheet tabs or Row 1 column headers. Fill data starting from Row 2.',
      'Sheet အမည်များနှင့် Row 1 ကော်လံခေါင်းစဉ်များကို မပြောင်းပါနှင့်။ Row 2 မှစ၍ ဒေတာဖြည့်ပါ။',
    ],
    [
      '2',
      'Amber headers = Required columns; Dark Slate headers = Optional / Auto-generated columns.',
      'လိမ္မော်ရောင်ခေါင်းစဉ် = မဖြစ်မနေ ဖြည့်ရမည့်ကော်လံ၊ မီးခိုးရင့်ခေါင်းစဉ် = ထည့်လိုက ထည့်နိုင်သောကော်လံ။',
    ],
    [
      '3',
      'Leave "id" blank to create new records, or keep existing "id" to update records (Additive Upsert — never deletes missing rows).',
      'Record အသစ်အတွက် id ကို ဗလာထားနိုင်ပြီး ရှိပြီးသားကို Update လုပ်ရန် id ကို ဆက်ထားပါ (မပါသောဒေတာကို မဖျက်ပါ)။',
    ],
    [
      '4',
      'Natural keys work in relation columns: categoryId (id/slug/name), productId (id/SKU), userId (id/email), customerId (id/phone), supplierId (id/name), saleId (id/invoiceNumber), purchaseOrderId (id/poNumber).',
      'ချိတ်ဆက်ကော်လံများတွင် id အပြင် natural key (SKU, email, phone, slug, invoiceNumber, poNumber) များလည်း အသုံးပြုနိုင်သည်။',
    ],
    [
      '5',
      'Dates use YYYY-MM-DD or YYYY-MM-DD HH:mm:ss. Phone numbers and barcodes are formatted as Text (@) to preserve leading zeros.',
      'ရက်စွဲများကို YYYY-MM-DD ဖြင့်ရေးပါ။ ဖုန်းနံပါတ်နှင့် ဘားကုဒ်များ 0 မပျောက်စေရန် Text (@) format သတ်မှတ်ထားပါသည်။',
    ],
    [
      '6',
      'Security: User passwords and payment gateway secrets are excluded from exports. Existing users keep their current password.',
      'လုံခြုံရေး — Export တွင် Password နှင့် Payment secret များမပါပါ။ ရှိပြီးသား User များ၏ Password မပြောင်းလဲပါ။',
    ],
  ];

  const sheetData: SheetData = [
    // Row 1: Branded Banner
    [
      {
        value: 'ShwePOS Enterprise Data Migration Workbook (v2.1)',
        type: String,
        columnSpan: 6,
        fontWeight: 'bold',
        fontSize: 15,
        backgroundColor: PALETTE.bannerBg,
        textColor: PALETTE.bannerText,
        alignVertical: 'center',
        height: 36,
      },
      null,
      null,
      null,
      null,
      null,
    ],
    // Row 2: Bilingual Subtitle
    [
      {
        value:
          `Complete ${sheetEntries.length}-Sheet Retail POS Backup & Migration Template — ရွှေPOS ဒေတာကူးပြောင်းမှုနှင့် Backup Excel ဖိုင်`,
        type: String,
        columnSpan: 6,
        fontStyle: 'italic',
        fontSize: 10.5,
        backgroundColor: PALETTE.subBannerBg,
        textColor: PALETTE.subBannerText,
        alignVertical: 'center',
        height: 24,
        bottomBorderColor: PALETTE.headerRequiredBg,
        bottomBorderStyle: 'medium',
      },
      null,
      null,
      null,
      null,
      null,
    ],
    // Row 3: Spacer
    [],
    // Rows 4-6: Workbook Metadata & Color Legend
    makeMetaRow(
      'Workbook Mode',
      isExport ? 'Full Database Export (Backup)' : 'Blank Migration Template',
      'Required Header Color',
      'AMBER = Required Column (မဖြစ်မနေ)',
      PALETTE.headerRequiredBg,
      PALETTE.headerText
    ),
    makeMetaRow(
      'Generated At (Asia/Yangon)',
      generatedAtMm,
      'Optional Header Color',
      'SLATE = Optional / Auto Column (ထည့်လိုကထည့်)',
      PALETTE.headerOptionalBg,
      PALETTE.headerText
    ),
    makeMetaRow(
      'Total Records Exported',
      totalRecords,
      'Total Data Sheets',
      `${sheetEntries.length} operational tables (full schema v2.1)`
    ),
    [],
    // Section 1: Quick Usage Guide
    makeSectionHeader('HOW TO USE / အသုံးပြုပုံ လမ်းညွှန်'),
    [
      {
        value: '#',
        type: String,
        fontWeight: 'bold',
        align: 'center',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        height: 24,
        alignVertical: 'center',
      },
      {
        value: 'English Instruction',
        type: String,
        columnSpan: 3,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
      null,
      null,
      {
        value: 'မြန်မာလို ရှင်းလင်းချက်',
        type: String,
        columnSpan: 2,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
      null,
    ],
    ...guideItems.map(([stepNo, en, mm], idx): Row => {
      const bg = idx % 2 === 1 ? PALETTE.zebraOddBg : PALETTE.zebraEvenBg;
      return [
        {
          value: stepNo,
          type: String,
          fontWeight: 'bold',
          align: 'center',
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.headerRequiredBg,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
          height: 30,
        },
        {
          value: en,
          type: String,
          columnSpan: 3,
          wrap: true,
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.textPrimary,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
        null,
        null,
        {
          value: mm,
          type: String,
          columnSpan: 2,
          wrap: true,
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.textPrimary,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
        null,
      ];
    }),
    [],
    // Section 2: Sheet Directory Table
    makeSectionHeader('SHEET DIRECTORY & RECORD COUNTS / SHEET စာရင်းနှင့် အချက်အလက်အကျဉ်းချုပ်'),
    [
      {
        value: '#',
        type: String,
        fontWeight: 'bold',
        align: 'center',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        height: 26,
        alignVertical: 'center',
      },
      {
        value: 'Module Group',
        type: String,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
      {
        value: 'Sheet Name',
        type: String,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
      {
        value: 'Rows',
        type: String,
        fontWeight: 'bold',
        align: 'right',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
      {
        value: 'Required Fields',
        type: String,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerRequiredBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerReqBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
      {
        value: 'Description & Relationships (EN / MM)',
        type: String,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
    ],
    ...sheetEntries.map(([name, def], idx): Row => {
      const bg = idx % 2 === 1 ? PALETTE.zebraOddBg : PALETTE.zebraEvenBg;
      const count = data[name]?.length ?? 0;
      return [
        {
          value: idx + 1,
          type: Number,
          align: 'center',
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.textMuted,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
          height: 34,
        },
        {
          value: `${def.group} (${def.groupMm})`,
          type: String,
          wrap: true,
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.textMuted,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
        {
          value: name,
          type: String,
          fontWeight: 'bold',
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.textPrimary,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
        {
          value: count,
          type: Number,
          format: '#,##0',
          align: 'right',
          alignVertical: 'center',
          fontWeight: count > 0 ? 'bold' : undefined,
          backgroundColor: bg,
          textColor: count > 0 ? PALETTE.textPrimary : PALETTE.textMuted,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
        {
          value: def.required.join(', '),
          type: String,
          wrap: true,
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.subBannerText,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
        {
          value: `${def.description}\n${def.descriptionMm}`,
          type: String,
          wrap: true,
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.textPrimary,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
      ];
    }),
    [],
    // Section 3: Allowed Enum Values Quick Reference
    makeSectionHeader('ALLOWED ENUM VALUES QUICK REFERENCE / သတ်မှတ်တန်ဖိုးများ ကိုးကားချက်'),
    [
      {
        value: 'Sheet.Column',
        type: String,
        columnSpan: 2,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        height: 24,
        alignVertical: 'center',
      },
      null,
      {
        value: 'Allowed Values',
        type: String,
        columnSpan: 2,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
      null,
      {
        value: 'Usage Notes',
        type: String,
        columnSpan: 2,
        fontWeight: 'bold',
        backgroundColor: PALETTE.headerOptionalBg,
        textColor: PALETTE.headerText,
        borderColor: PALETTE.headerBorder,
        borderStyle: 'thin',
        alignVertical: 'center',
      },
      null,
    ],
    ...ENUM_REFERENCE_ROWS.map((item, idx): Row => {
      const bg = idx % 2 === 1 ? PALETTE.zebraOddBg : PALETTE.zebraEvenBg;
      return [
        {
          value: item.target,
          type: String,
          columnSpan: 2,
          fontWeight: 'bold',
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.textPrimary,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
          height: 24,
        },
        null,
        {
          value: item.values,
          type: String,
          columnSpan: 2,
          wrap: true,
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.headerRequiredBg,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
        null,
        {
          value: item.notes,
          type: String,
          columnSpan: 2,
          wrap: true,
          alignVertical: 'center',
          backgroundColor: bg,
          textColor: PALETTE.textMuted,
          borderColor: PALETTE.cellBorder,
          borderStyle: 'thin',
        },
        null,
      ];
    }),
  ];

  return {
    data: sheetData,
    sheet: INSTRUCTIONS_SHEET,
    columns: [
      { width: 6 },
      { width: 26 },
      { width: 24 },
      { width: 12 },
      { width: 32 },
      { width: 68 },
    ],
    stickyRowsCount: 2,
    orientation: 'landscape',
  };
}

export function createDataMigrationWorkbook(data: MigrationRows = {}): MigrationWorkbook {
  const workbook: MigrationWorkbook = [buildInstructionsSheet(data)];

  for (const [sheetName, definition] of Object.entries(DATA_MIGRATION_SHEETS) as Array<
    [MigrationSheetName, MigrationSheetDefinition]
  >) {
    const rows = data[sheetName] ?? [];
    const headerRow = buildHeaderRow(definition);
    const dataRows: Row[] = rows.map((record, rowIdx) =>
      definition.headers.map((header): Cell => {
        const kind = definition.columns[header]?.kind ?? 'text';
        return buildStyledDataCell(record[header], kind, rowIdx);
      })
    );

    workbook.push({
      data: [headerRow, ...dataRows],
      sheet: sheetName,
      columns: computeColumnWidths(definition, rows),
      stickyRowsCount: 1,
      orientation: 'landscape',
      dateFormat: 'yyyy-mm-dd hh:mm:ss',
    });
  }

  return workbook;
}

export async function workbookBuffer(workbook: MigrationWorkbook): Promise<Buffer> {
  return writeXlsxFile(workbook, {
    fontFamily: 'Calibri',
    fontSize: 10,
  }).toBuffer();
}
