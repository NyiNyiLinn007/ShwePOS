export type MigrationColumnKind =
  | 'id'
  | 'text'
  | 'code'
  | 'enum'
  | 'status'
  | 'money'
  | 'qty'
  | 'int'
  | 'percent'
  | 'bool'
  | 'date'
  | 'datetime'
  | 'media'
  | 'secret';

export interface MigrationColumnSpec {
  kind: MigrationColumnKind;
  width: number;
}

export interface MigrationSheetDefinition {
  group: string;
  groupMm: string;
  headers: readonly string[];
  required: readonly string[];
  description: string;
  descriptionMm: string;
  columns: Readonly<Record<string, MigrationColumnSpec>>;
}

export const INSTRUCTIONS_SHEET = 'Instructions';

export const USER_ROLES = new Set(['ADMIN', 'MANAGER', 'CASHIER']);
export const PAYMENT_METHODS = new Set(['CASH', 'CARD', 'MOBILE_BANKING', 'CREDIT', 'SPLIT']);
export const SALE_PAYMENT_METHODS = new Set(['CASH', 'CARD', 'MOBILE_BANKING', 'CREDIT', 'BANK_TRANSFER']);
export const SALE_PAYMENT_TYPES = new Set(['CHECKOUT', 'DEBT_REPAYMENT']);
export const PAYMENT_STATUSES = new Set(['PAID', 'PARTIAL', 'PENDING', 'FAILED', 'REVERSED']);
export const SALE_STATUSES = new Set(['COMPLETED', 'PARTIALLY_REFUNDED', 'REFUNDED', 'VOIDED']);
export const MOVEMENT_TYPES = new Set(['IN', 'OUT', 'ADJUSTMENT', 'RETURN']);
export const SHIFT_STATUSES = new Set(['OPEN', 'CLOSED']);
export const CASH_MOVEMENT_TYPES = new Set([
  'OPENING',
  'CASH_SALE',
  'REFUND',
  'VOID',
  'PAID_IN',
  'PAID_OUT',
  'CLOSING',
]);
export const ADJUSTMENT_TYPES = new Set(['REFUND', 'PARTIAL_REFUND', 'VOID']);
export const REVERSAL_STATUSES = new Set(['PENDING', 'COMPLETED', 'FAILED', 'NOT_REQUIRED']);
export const PRODUCT_UNITS = new Set([
  'pcs',
  'kg',
  'g',
  'liter',
  'ml',
  'pack',
  'box',
  'bottle',
  'dozen',
  'set',
]);
export const PURCHASE_PAYMENT_METHODS = new Set(['CASH', 'BANK_TRANSFER', 'MOBILE_BANKING', 'CREDIT']);
export const PURCHASE_STATUSES = new Set(['RECEIVED', 'CANCELLED']);
export const SUPPLIER_PAYMENT_METHODS = new Set(['CASH', 'BANK_TRANSFER', 'MOBILE_BANKING']);
export const PROMOTION_TYPES = new Set([
  'PERCENT_OFF',
  'FIXED_OFF',
  'BUY_X_GET_Y',
  'MIN_SPEND_PERCENT',
  'MIN_SPEND_FIXED',
]);
export const QUOTATION_STATUSES = new Set([
  'DRAFT',
  'SENT',
  'ACCEPTED',
  'CONVERTED',
  'EXPIRED',
  'CANCELLED',
]);
export const STOCKTAKE_STATUSES = new Set(['IN_PROGRESS', 'COMPLETED', 'CANCELLED']);

export const DATA_MIGRATION_SHEETS = {
  Users: {
    group: 'Master Data',
    groupMm: 'အခြေခံဒေတာ',
    headers: [
      'id',
      'name',
      'email',
      'password',
      'role',
      'phone',
      'isActive',
      'sessionVersion',
      'lastLoginAt',
      'createdAt',
      'updatedAt',
    ],
    required: ['name', 'email'],
    description:
      'System accounts. Passwords are excluded from exports; existing users keep their password while new users need a strong password (8+ chars with letters & digits).',
    descriptionMm:
      'စနစ်အသုံးပြုသူများ။ Export တွင် Password မပါပါ။ ရှိပြီးသား User များ Password မပြောင်းဘဲ အသစ်ထည့်ပါက Password (စာလုံး ၈ လုံးနှင့်အထက်) ထည့်ရမည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      name: { kind: 'text', width: 24 },
      email: { kind: 'text', width: 28 },
      password: { kind: 'secret', width: 18 },
      role: { kind: 'enum', width: 14 },
      phone: { kind: 'code', width: 18 },
      isActive: { kind: 'bool', width: 12 },
      sessionVersion: { kind: 'int', width: 15 },
      lastLoginAt: { kind: 'datetime', width: 22 },
      createdAt: { kind: 'datetime', width: 22 },
      updatedAt: { kind: 'datetime', width: 22 },
    },
  },
  Categories: {
    group: 'Master Data',
    groupMm: 'အခြေခံဒေတာ',
    headers: ['id', 'name', 'nameMm', 'description', 'slug', 'isActive', 'createdAt'],
    required: ['name', 'slug'],
    description: 'Product categories. Products can reference categoryId by id, slug, or exact name.',
    descriptionMm: 'ကုန်ပစ္စည်းအမျိုးအစားများ။ Products sheet တွင် categoryId ကို id, slug သို့မဟုတ် အမည်ဖြင့် ချိတ်ဆက်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      name: { kind: 'text', width: 24 },
      nameMm: { kind: 'text', width: 24 },
      description: { kind: 'text', width: 34 },
      slug: { kind: 'code', width: 22 },
      isActive: { kind: 'bool', width: 12 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  Products: {
    group: 'Inventory & Packaging',
    groupMm: 'ကုန်ပစ္စည်းနှင့် ယူနစ်',
    headers: [
      'id',
      'name',
      'nameMm',
      'sku',
      'barcode',
      'categoryId',
      'costPrice',
      'sellingPrice',
      'stockQuantity',
      'lowStockThreshold',
      'unit',
      'batchNumber',
      'expiryDate',
      'imageUrl',
      'isActive',
      'createdAt',
      'updatedAt',
    ],
    required: ['name', 'sku', 'categoryId'],
    description:
      'Product catalog with stock, batch/expiry tracking, and base selling unit. categoryId accepts id, slug, or exact name.',
    descriptionMm:
      'ကုန်ပစ္စည်းစာရင်း (လက်ကျန်၊ Batch/သက်တမ်းကုန်ရက်နှင့် အခြေခံယူနစ်အပါအဝင်)။ categoryId တွင် id, slug သို့မဟုတ် အမည်ထည့်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      name: { kind: 'text', width: 28 },
      nameMm: { kind: 'text', width: 28 },
      sku: { kind: 'code', width: 18 },
      barcode: { kind: 'code', width: 20 },
      categoryId: { kind: 'code', width: 24 },
      costPrice: { kind: 'money', width: 15 },
      sellingPrice: { kind: 'money', width: 15 },
      stockQuantity: { kind: 'qty', width: 15 },
      lowStockThreshold: { kind: 'qty', width: 18 },
      unit: { kind: 'enum', width: 12 },
      batchNumber: { kind: 'code', width: 18 },
      expiryDate: { kind: 'date', width: 15 },
      imageUrl: { kind: 'media', width: 24 },
      isActive: { kind: 'bool', width: 12 },
      createdAt: { kind: 'datetime', width: 22 },
      updatedAt: { kind: 'datetime', width: 22 },
    },
  },
  ProductUnits: {
    group: 'Inventory & Packaging',
    groupMm: 'ကုန်ပစ္စည်းနှင့် ယူနစ်',
    headers: [
      'id',
      'productId',
      'unitName',
      'nameMm',
      'conversionFactor',
      'sellingPrice',
      'barcode',
      'createdAt',
      'updatedAt',
    ],
    required: ['productId', 'unitName', 'conversionFactor', 'sellingPrice'],
    description:
      'Alternate packaging / wholesale units (e.g., carton = 24 pcs). productId accepts id or SKU.',
    descriptionMm:
      'လက္ကား/ထုပ်ပိုးမှု ယူနစ်အပိုများ (ဥပမာ carton = 24 pcs)။ productId တွင် id သို့မဟုတ် SKU ထည့်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      productId: { kind: 'code', width: 24 },
      unitName: { kind: 'text', width: 16 },
      nameMm: { kind: 'text', width: 18 },
      conversionFactor: { kind: 'qty', width: 18 },
      sellingPrice: { kind: 'money', width: 15 },
      barcode: { kind: 'code', width: 20 },
      createdAt: { kind: 'datetime', width: 22 },
      updatedAt: { kind: 'datetime', width: 22 },
    },
  },
  Customers: {
    group: 'Master Data',
    groupMm: 'အခြေခံဒေတာ',
    headers: [
      'id',
      'name',
      'phone',
      'email',
      'address',
      'totalPurchases',
      'creditBalance',
      'creditLimit',
      'loyaltyPoints',
      'createdAt',
      'updatedAt',
    ],
    required: ['name'],
    description:
      'Customer directory including credit balance/limit and loyalty points. Phone is used as unique match key when id is blank.',
    descriptionMm:
      'ဖောက်သည်စာရင်း (အကြွေးကျန်၊ အကြွေးကန့်သတ်ချက်နှင့် Loyalty ပွိုင့်အပါအဝင်)။ id ဗလာထားပါက ဖုန်းနံပါတ်ဖြင့် တိုက်ဆိုင်မည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      name: { kind: 'text', width: 24 },
      phone: { kind: 'code', width: 18 },
      email: { kind: 'text', width: 26 },
      address: { kind: 'text', width: 32 },
      totalPurchases: { kind: 'money', width: 16 },
      creditBalance: { kind: 'money', width: 16 },
      creditLimit: { kind: 'money', width: 16 },
      loyaltyPoints: { kind: 'int', width: 15 },
      createdAt: { kind: 'datetime', width: 22 },
      updatedAt: { kind: 'datetime', width: 22 },
    },
  },
  Suppliers: {
    group: 'Purchasing & Suppliers',
    groupMm: 'ကုန်ပေးသွင်းသူနှင့် အဝယ်',
    headers: [
      'id',
      'name',
      'contactPerson',
      'phone',
      'email',
      'address',
      'creditBalance',
      'notes',
      'isActive',
      'createdAt',
      'updatedAt',
    ],
    required: ['name'],
    description:
      'Supplier directory & Accounts Payable credit balances. PurchaseOrders and SupplierPayments can match supplierId by id or exact name.',
    descriptionMm:
      'ကုန်ပေးသွင်းသူစာရင်းနှင့် ပေးရန်ကြွေးကျန်များ။ PurchaseOrders တွင် supplierId ကို id သို့မဟုတ် အမည်ဖြင့် ချိတ်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      name: { kind: 'text', width: 26 },
      contactPerson: { kind: 'text', width: 22 },
      phone: { kind: 'code', width: 18 },
      email: { kind: 'text', width: 26 },
      address: { kind: 'text', width: 32 },
      creditBalance: { kind: 'money', width: 16 },
      notes: { kind: 'text', width: 30 },
      isActive: { kind: 'bool', width: 12 },
      createdAt: { kind: 'datetime', width: 22 },
      updatedAt: { kind: 'datetime', width: 22 },
    },
  },
  PurchaseOrders: {
    group: 'Purchasing & Suppliers',
    groupMm: 'ကုန်ပေးသွင်းသူနှင့် အဝယ်',
    headers: [
      'id',
      'poNumber',
      'supplierId',
      'userId',
      'subtotal',
      'discountAmount',
      'totalAmount',
      'paidAmount',
      'dueAmount',
      'paymentMethod',
      'status',
      'notes',
      'createdAt',
    ],
    required: ['poNumber', 'supplierId', 'userId'],
    description:
      'Goods Receiving / Purchase Orders. supplierId accepts id or name; userId accepts id or email. Importing does not double-count stock.',
    descriptionMm:
      'ကုန်ဝယ်ယူမှု (PO) မှတ်တမ်းများ။ supplierId တွင် id/အမည်၊ userId တွင် id/email ထည့်နိုင်သည်။ Stock ကို ထပ်မံမပေါင်းပါ။',
    columns: {
      id: { kind: 'id', width: 26 },
      poNumber: { kind: 'code', width: 20 },
      supplierId: { kind: 'code', width: 24 },
      userId: { kind: 'code', width: 24 },
      subtotal: { kind: 'money', width: 15 },
      discountAmount: { kind: 'money', width: 16 },
      totalAmount: { kind: 'money', width: 15 },
      paidAmount: { kind: 'money', width: 15 },
      dueAmount: { kind: 'money', width: 15 },
      paymentMethod: { kind: 'enum', width: 18 },
      status: { kind: 'status', width: 14 },
      notes: { kind: 'text', width: 30 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  PurchaseItems: {
    group: 'Purchasing & Suppliers',
    groupMm: 'ကုန်ပေးသွင်းသူနှင့် အဝယ်',
    headers: [
      'id',
      'purchaseOrderId',
      'productId',
      'quantity',
      'unitCost',
      'total',
      'batchNumber',
      'expiryDate',
    ],
    required: ['purchaseOrderId', 'productId', 'quantity', 'unitCost'],
    description:
      'Line items of Purchase Orders. purchaseOrderId accepts id or poNumber; productId accepts id or SKU.',
    descriptionMm:
      'PO အဝယ်ဘောင်ချာပါ ပစ္စည်းစာရင်း။ purchaseOrderId တွင် id/poNumber၊ productId တွင် id/SKU ထည့်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      purchaseOrderId: { kind: 'code', width: 22 },
      productId: { kind: 'code', width: 24 },
      quantity: { kind: 'qty', width: 14 },
      unitCost: { kind: 'money', width: 15 },
      total: { kind: 'money', width: 15 },
      batchNumber: { kind: 'code', width: 18 },
      expiryDate: { kind: 'date', width: 15 },
    },
  },
  SupplierPayments: {
    group: 'Purchasing & Suppliers',
    groupMm: 'ကုန်ပေးသွင်းသူနှင့် အဝယ်',
    headers: ['id', 'supplierId', 'userId', 'amount', 'method', 'reference', 'notes', 'createdAt'],
    required: ['supplierId', 'userId', 'amount'],
    description:
      'Supplier debt repayments (Accounts Payable). supplierId accepts id or name; userId accepts id or email.',
    descriptionMm:
      'ကုန်ပေးသွင်းသူသို့ အကြွေးပြန်ဆပ်မှုမှတ်တမ်းများ။ supplierId တွင် id/အမည်၊ userId တွင် id/email ထည့်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      supplierId: { kind: 'code', width: 24 },
      userId: { kind: 'code', width: 24 },
      amount: { kind: 'money', width: 15 },
      method: { kind: 'enum', width: 18 },
      reference: { kind: 'code', width: 20 },
      notes: { kind: 'text', width: 30 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  Shifts: {
    group: 'Cash & Accounting',
    groupMm: 'ငွေစာရင်းနှင့် အဆိုင်း',
    headers: [
      'id',
      'userId',
      'openingCash',
      'closingCash',
      'expectedCash',
      'actualCash',
      'variance',
      'status',
      'openedAt',
      'closedAt',
      'notes',
    ],
    required: ['userId', 'openingCash', 'status', 'openedAt'],
    description:
      'Cashier shifts & cash drawer reconciliation. Imported before SalePayments and CashDrawerMovements.',
    descriptionMm:
      'ငွေကိုင်အဆိုင်းနှင့် အံဆွဲစာရင်းရှင်းတမ်းများ။ userId တွင် id သို့မဟုတ် email ထည့်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      userId: { kind: 'code', width: 24 },
      openingCash: { kind: 'money', width: 15 },
      closingCash: { kind: 'money', width: 15 },
      expectedCash: { kind: 'money', width: 15 },
      actualCash: { kind: 'money', width: 15 },
      variance: { kind: 'money', width: 15 },
      status: { kind: 'status', width: 12 },
      openedAt: { kind: 'datetime', width: 22 },
      closedAt: { kind: 'datetime', width: 22 },
      notes: { kind: 'text', width: 30 },
    },
  },
  Sales: {
    group: 'Sales & POS',
    groupMm: 'အရောင်းစာရင်း',
    headers: [
      'id',
      'invoiceNumber',
      'clientSaleId',
      'customerId',
      'userId',
      'subtotal',
      'discountAmount',
      'taxAmount',
      'totalAmount',
      'paidAmount',
      'dueAmount',
      'changeAmount',
      'pointsEarned',
      'pointsRedeemed',
      'promotionId',
      'promotionCode',
      'promotionDiscount',
      'paymentMethod',
      'paymentStatus',
      'paymentReference',
      'paymentProviderResponse',
      'status',
      'notes',
      'createdAt',
    ],
    required: ['invoiceNumber', 'userId'],
    description:
      'POS invoices including credit dueAmount and loyalty points. userId accepts id/email; customerId accepts id/phone. Payment gateway secrets are blank in exports.',
    descriptionMm:
      'အရောင်းဘောင်ချာများ (အကြွေးကျန်နှင့် Loyalty ပွိုင့်အပါအဝင်)။ userId တွင် id/email၊ customerId တွင် id/phone ထည့်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      invoiceNumber: { kind: 'code', width: 22 },
      clientSaleId: { kind: 'code', width: 26 },
      customerId: { kind: 'code', width: 24 },
      userId: { kind: 'code', width: 24 },
      subtotal: { kind: 'money', width: 15 },
      discountAmount: { kind: 'money', width: 16 },
      taxAmount: { kind: 'money', width: 14 },
      totalAmount: { kind: 'money', width: 15 },
      paidAmount: { kind: 'money', width: 15 },
      dueAmount: { kind: 'money', width: 15 },
      changeAmount: { kind: 'money', width: 15 },
      pointsEarned: { kind: 'int', width: 14 },
      pointsRedeemed: { kind: 'int', width: 15 },
      promotionId: { kind: 'id', width: 24 },
      promotionCode: { kind: 'code', width: 16 },
      promotionDiscount: { kind: 'money', width: 17 },
      paymentMethod: { kind: 'enum', width: 18 },
      paymentStatus: { kind: 'status', width: 15 },
      paymentReference: { kind: 'secret', width: 18 },
      paymentProviderResponse: { kind: 'secret', width: 22 },
      status: { kind: 'status', width: 20 },
      notes: { kind: 'text', width: 30 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  SaleItems: {
    group: 'Sales & POS',
    groupMm: 'အရောင်းစာရင်း',
    headers: [
      'id',
      'saleId',
      'productId',
      'quantity',
      'refundedQuantity',
      'unitName',
      'unitFactor',
      'unitPrice',
      'costPrice',
      'discount',
      'total',
    ],
    required: ['saleId', 'productId', 'quantity'],
    description:
      'Sale line items with multi-unit info (unitName/unitFactor) and refundedQuantity. saleId accepts id or invoiceNumber; productId accepts id or SKU.',
    descriptionMm:
      'ဘောင်ချာပါ အရောင်းပစ္စည်းများ (Multi-Unit နှင့် ပြန်အမ်းပြီးအရေအတွက်အပါအဝင်)။ saleId တွင် id/invoiceNumber၊ productId တွင် id/SKU ထည့်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      saleId: { kind: 'code', width: 22 },
      productId: { kind: 'code', width: 24 },
      quantity: { kind: 'qty', width: 14 },
      refundedQuantity: { kind: 'qty', width: 17 },
      unitName: { kind: 'text', width: 14 },
      unitFactor: { kind: 'qty', width: 14 },
      unitPrice: { kind: 'money', width: 15 },
      costPrice: { kind: 'money', width: 15 },
      discount: { kind: 'money', width: 14 },
      total: { kind: 'money', width: 15 },
    },
  },
  SalePayments: {
    group: 'Sales & POS',
    groupMm: 'အရောင်းစာရင်း',
    headers: [
      'id',
      'saleId',
      'customerId',
      'userId',
      'shiftId',
      'method',
      'amount',
      'reference',
      'type',
      'notes',
      'createdAt',
    ],
    required: ['userId', 'method', 'amount'],
    description:
      'Split payment legs and customer credit debt repayments. saleId accepts id/invoiceNumber; customerId accepts id/phone.',
    descriptionMm:
      'ပေါင်းစပ်ငွေပေးချေမှုအပိုင်းများနှင့် ဖောက်သည်အကြွေးပြန်ဆပ်မှုမှတ်တမ်းများ။',
    columns: {
      id: { kind: 'id', width: 26 },
      saleId: { kind: 'code', width: 22 },
      customerId: { kind: 'code', width: 24 },
      userId: { kind: 'code', width: 24 },
      shiftId: { kind: 'id', width: 26 },
      method: { kind: 'enum', width: 18 },
      amount: { kind: 'money', width: 15 },
      reference: { kind: 'code', width: 20 },
      type: { kind: 'enum', width: 18 },
      notes: { kind: 'text', width: 30 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  SaleAdjustments: {
    group: 'Sales & POS',
    groupMm: 'အရောင်းစာရင်း',
    headers: [
      'id',
      'saleId',
      'approverUserId',
      'type',
      'reason',
      'amount',
      'paymentMethod',
      'paymentReversalStatus',
      'createdAt',
    ],
    required: ['saleId', 'approverUserId', 'type', 'reason', 'amount', 'paymentMethod'],
    description:
      'Sale refunds, partial refunds, and void approval records. saleId accepts id or invoiceNumber.',
    descriptionMm:
      'ဘောင်ချာပယ်ဖျက်ခြင်းနှင့် ငွေပြန်အမ်းခြင်း အတည်ပြုမှတ်တမ်းများ။',
    columns: {
      id: { kind: 'id', width: 26 },
      saleId: { kind: 'code', width: 22 },
      approverUserId: { kind: 'code', width: 24 },
      type: { kind: 'enum', width: 17 },
      reason: { kind: 'text', width: 32 },
      amount: { kind: 'money', width: 15 },
      paymentMethod: { kind: 'enum', width: 18 },
      paymentReversalStatus: { kind: 'status', width: 22 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  StockMovements: {
    group: 'Inventory & Packaging',
    groupMm: 'ကုန်ပစ္စည်းနှင့် ယူနစ်',
    headers: [
      'id',
      'productId',
      'userId',
      'saleId',
      'quantity',
      'type',
      'reason',
      'previousStock',
      'newStock',
      'createdAt',
    ],
    required: ['productId', 'userId', 'quantity', 'type', 'previousStock', 'newStock'],
    description:
      'Inventory movement audit trail (IN, OUT, ADJUSTMENT, RETURN). Importing preserves history without recalculating Product.stockQuantity.',
    descriptionMm:
      'ကုန်လက်ကျန် အဝင်/အထွက်/ချိန်ညှိမှု မှတ်တမ်းများ။ Import လုပ်ရာတွင် Product stock ကို ထပ်မတွက်ပါ။',
    columns: {
      id: { kind: 'id', width: 26 },
      productId: { kind: 'code', width: 24 },
      userId: { kind: 'code', width: 24 },
      saleId: { kind: 'code', width: 22 },
      quantity: { kind: 'qty', width: 14 },
      type: { kind: 'enum', width: 15 },
      reason: { kind: 'text', width: 32 },
      previousStock: { kind: 'qty', width: 15 },
      newStock: { kind: 'qty', width: 15 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  Expenses: {
    group: 'Cash & Accounting',
    groupMm: 'ငွေစာရင်းနှင့် အဆိုင်း',
    headers: ['id', 'category', 'amount', 'description', 'userId', 'date', 'createdAt'],
    required: ['category', 'amount', 'userId'],
    description: 'Operating expenses used in Net Profit reporting. userId accepts id or email.',
    descriptionMm: 'ဆိုင်အသုံးစရိတ်မှတ်တမ်းများ (အသားတင်အမြတ် တွက်ချက်ရာတွင် အသုံးပြုသည်)။',
    columns: {
      id: { kind: 'id', width: 26 },
      category: { kind: 'text', width: 20 },
      amount: { kind: 'money', width: 15 },
      description: { kind: 'text', width: 34 },
      userId: { kind: 'code', width: 24 },
      date: { kind: 'datetime', width: 22 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  CashDrawerMovements: {
    group: 'Cash & Accounting',
    groupMm: 'ငွေစာရင်းနှင့် အဆိုင်း',
    headers: ['id', 'shiftId', 'saleId', 'expenseId', 'userId', 'type', 'amount', 'reason', 'createdAt'],
    required: ['userId', 'type', 'amount'],
    description:
      'Cash drawer log (OPENING, CASH_SALE, PAID_IN, PAID_OUT, REFUND, VOID, CLOSING). saleId accepts id or invoiceNumber.',
    descriptionMm:
      'ငွေအံဆွဲ အဝင်/အထွက် မှတ်တမ်းများ (OPENING, CASH_SALE, PAID_IN, PAID_OUT, REFUND, VOID, CLOSING)။',
    columns: {
      id: { kind: 'id', width: 26 },
      shiftId: { kind: 'id', width: 26 },
      saleId: { kind: 'code', width: 22 },
      expenseId: { kind: 'id', width: 26 },
      userId: { kind: 'code', width: 24 },
      type: { kind: 'enum', width: 15 },
      amount: { kind: 'money', width: 15 },
      reason: { kind: 'text', width: 32 },
      createdAt: { kind: 'datetime', width: 22 },
    },
  },
  Promotions: {
    group: 'Sales & POS',
    groupMm: 'အရောင်းစာရင်း',
    headers: [
      'id',
      'name',
      'nameMm',
      'code',
      'type',
      'discountValue',
      'minSpend',
      'buyQty',
      'getQty',
      'categoryId',
      'productId',
      'startDate',
      'endDate',
      'usageLimit',
      'usedCount',
      'isActive',
      'createdAt',
      'updatedAt',
    ],
    required: ['name', 'type', 'startDate', 'endDate'],
    description:
      'Auto-applied promotions & coupon codes. categoryId accepts id/slug/name; productId accepts id/SKU.',
    descriptionMm:
      'အလိုအလျောက် ပရိုမိုးရှင်းနှင့် Promo Code များ။ categoryId တွင် id/slug/name၊ productId တွင် id/SKU ထည့်နိုင်သည်။',
    columns: {
      id: { kind: 'id', width: 26 },
      name: { kind: 'text', width: 26 },
      nameMm: { kind: 'text', width: 26 },
      code: { kind: 'code', width: 16 },
      type: { kind: 'enum', width: 20 },
      discountValue: { kind: 'money', width: 15 },
      minSpend: { kind: 'money', width: 15 },
      buyQty: { kind: 'int', width: 10 },
      getQty: { kind: 'int', width: 10 },
      categoryId: { kind: 'code', width: 22 },
      productId: { kind: 'code', width: 22 },
      startDate: { kind: 'datetime', width: 22 },
      endDate: { kind: 'datetime', width: 22 },
      usageLimit: { kind: 'int', width: 12 },
      usedCount: { kind: 'int', width: 12 },
      isActive: { kind: 'bool', width: 12 },
      createdAt: { kind: 'datetime', width: 22 },
      updatedAt: { kind: 'datetime', width: 22 },
    },
  },
  Quotations: {
    group: 'Sales & POS',
    groupMm: 'အရောင်းစာရင်း',
    headers: [
      'id',
      'quoteNumber',
      'customerId',
      'customerName',
      'customerPhone',
      'userId',
      'subtotal',
      'discountAmount',
      'taxAmount',
      'totalAmount',
      'status',
      'validUntil',
      'convertedSaleId',
      'notes',
      'createdAt',
      'updatedAt',
    ],
    required: ['quoteNumber', 'userId', 'validUntil'],
    description:
      'Proforma invoices & quotations. customerId accepts id/phone; userId accepts id/email.',
    descriptionMm: 'ဈေးနှုန်းကမ်းလှမ်းလွှာ (Quotation) မှတ်တမ်းများ။',
    columns: {
      id: { kind: 'id', width: 26 },
      quoteNumber: { kind: 'code', width: 20 },
      customerId: { kind: 'code', width: 24 },
      customerName: { kind: 'text', width: 24 },
      customerPhone: { kind: 'code', width: 18 },
      userId: { kind: 'code', width: 24 },
      subtotal: { kind: 'money', width: 15 },
      discountAmount: { kind: 'money', width: 16 },
      taxAmount: { kind: 'money', width: 14 },
      totalAmount: { kind: 'money', width: 15 },
      status: { kind: 'status', width: 14 },
      validUntil: { kind: 'datetime', width: 22 },
      convertedSaleId: { kind: 'code', width: 22 },
      notes: { kind: 'text', width: 30 },
      createdAt: { kind: 'datetime', width: 22 },
      updatedAt: { kind: 'datetime', width: 22 },
    },
  },
  QuotationItems: {
    group: 'Sales & POS',
    groupMm: 'အရောင်းစာရင်း',
    headers: [
      'id',
      'quotationId',
      'productId',
      'quantity',
      'unitName',
      'unitFactor',
      'unitPrice',
      'discount',
      'total',
    ],
    required: ['quotationId', 'productId', 'quantity'],
    description:
      'Line items of Quotations. quotationId accepts id or quoteNumber; productId accepts id or SKU.',
    descriptionMm: 'Quotation ပါ ပစ္စည်းစာရင်းများ။',
    columns: {
      id: { kind: 'id', width: 26 },
      quotationId: { kind: 'code', width: 22 },
      productId: { kind: 'code', width: 24 },
      quantity: { kind: 'qty', width: 14 },
      unitName: { kind: 'text', width: 14 },
      unitFactor: { kind: 'qty', width: 14 },
      unitPrice: { kind: 'money', width: 15 },
      discount: { kind: 'money', width: 14 },
      total: { kind: 'money', width: 15 },
    },
  },
  StocktakeSessions: {
    group: 'Inventory & Packaging',
    groupMm: 'ကုန်ပစ္စည်းနှင့် ယူနစ်',
    headers: [
      'id',
      'sessionNumber',
      'status',
      'categoryId',
      'userId',
      'completedById',
      'notes',
      'totalItems',
      'varianceItems',
      'totalVarianceValue',
      'createdAt',
      'completedAt',
      'updatedAt',
    ],
    required: ['sessionNumber', 'userId'],
    description: 'Physical stocktake count sessions (ST-YYYYMMDD-XXXX).',
    descriptionMm: 'ကုန်လက်ကျန် စစ်ဆေးတိုက်ဆိုင်မှု အစီအစဉ်မှတ်တမ်းများ။',
    columns: {
      id: { kind: 'id', width: 26 },
      sessionNumber: { kind: 'code', width: 20 },
      status: { kind: 'status', width: 15 },
      categoryId: { kind: 'code', width: 22 },
      userId: { kind: 'code', width: 24 },
      completedById: { kind: 'code', width: 24 },
      notes: { kind: 'text', width: 30 },
      totalItems: { kind: 'int', width: 12 },
      varianceItems: { kind: 'int', width: 14 },
      totalVarianceValue: { kind: 'money', width: 18 },
      createdAt: { kind: 'datetime', width: 22 },
      completedAt: { kind: 'datetime', width: 22 },
      updatedAt: { kind: 'datetime', width: 22 },
    },
  },
  StocktakeItems: {
    group: 'Inventory & Packaging',
    groupMm: 'ကုန်ပစ္စည်းနှင့် ယူနစ်',
    headers: [
      'id',
      'sessionId',
      'productId',
      'systemQty',
      'countedQty',
      'varianceQty',
      'unitCost',
      'varianceValue',
      'notes',
    ],
    required: ['sessionId', 'productId', 'systemQty'],
    description: 'Per-product counts & variances inside each stocktake session.',
    descriptionMm: 'Stocktake အတွင်း ပစ္စည်းတစ်ခုချင်းစီ၏ ရေတွက်မှုနှင့် ကွာဟချက်များ။',
    columns: {
      id: { kind: 'id', width: 26 },
      sessionId: { kind: 'code', width: 22 },
      productId: { kind: 'code', width: 24 },
      systemQty: { kind: 'qty', width: 14 },
      countedQty: { kind: 'qty', width: 14 },
      varianceQty: { kind: 'qty', width: 14 },
      unitCost: { kind: 'money', width: 15 },
      varianceValue: { kind: 'money', width: 16 },
      notes: { kind: 'text', width: 30 },
    },
  },
  Settings: {
    group: 'System',
    groupMm: 'စနစ်ဆက်တင်',
    headers: [
      'id',
      'businessName',
      'businessNameMm',
      'address',
      'phone',
      'email',
      'taxRate',
      'currencySymbol',
      'loyaltyEnabled',
      'loyaltyEarnRate',
      'loyaltyRedeemRate',
      'mobileBankingName',
      'mobileBankingQrUrl',
      'logo',
      'receiptFooter',
    ],
    required: ['businessName', 'taxRate', 'currencySymbol'],
    description:
      'Store profile, tax rate, loyalty program rules, and Mobile Banking QR configuration. Default row uses id = default.',
    descriptionMm:
      'ဆိုင်အချက်အလက်၊ အခွန်နှုန်း၊ Loyalty စည်းမျဉ်းနှင့် Mobile Banking QR ဆက်တင်များ (ပုံမှန် id = default)။',
    columns: {
      id: { kind: 'id', width: 16 },
      businessName: { kind: 'text', width: 26 },
      businessNameMm: { kind: 'text', width: 26 },
      address: { kind: 'text', width: 34 },
      phone: { kind: 'code', width: 18 },
      email: { kind: 'text', width: 26 },
      taxRate: { kind: 'percent', width: 12 },
      currencySymbol: { kind: 'text', width: 16 },
      loyaltyEnabled: { kind: 'bool', width: 15 },
      loyaltyEarnRate: { kind: 'money', width: 17 },
      loyaltyRedeemRate: { kind: 'money', width: 18 },
      mobileBankingName: { kind: 'text', width: 24 },
      mobileBankingQrUrl: { kind: 'media', width: 24 },
      logo: { kind: 'media', width: 24 },
      receiptFooter: { kind: 'text', width: 34 },
    },
  },
  InvoiceCounters: {
    group: 'System',
    groupMm: 'စနစ်ဆက်တင်',
    headers: ['date', 'counter'],
    required: ['date', 'counter'],
    description:
      'Daily sequence counters in Myanmar time (YYYYMMDD Sales, PO-YYYYMMDD Purchases, ST-YYYYMMDD Stocktakes, QT-YYYYMMDD Quotations).',
    descriptionMm:
      'နေ့စဉ် အစဉ်လိုက်နံပါတ်မှတ်တမ်း (အရောင်း YYYYMMDD, အဝယ် PO-, Stocktake ST-, Quotation QT-)။',
    columns: {
      date: { kind: 'code', width: 18 },
      counter: { kind: 'int', width: 14 },
    },
  },
} as const satisfies Record<string, MigrationSheetDefinition>;

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

export const ENUM_REFERENCE_ROWS: ReadonlyArray<{
  target: string;
  values: string;
  notes: string;
}> = [
  {
    target: 'Users.role',
    values: Array.from(USER_ROLES).join(' | '),
    notes: 'ADMIN = Full access, MANAGER = Operations & Reports, CASHIER = POS & Shifts',
  },
  {
    target: 'Products.unit',
    values: Array.from(PRODUCT_UNITS).join(' | '),
    notes: 'Fractional units (kg, g, liter, ml) allow decimal quantities like 0.500',
  },
  {
    target: 'Sales.paymentMethod',
    values: Array.from(PAYMENT_METHODS).join(' | '),
    notes: 'Use SPLIT together with SalePayments legs; CREDIT requires customerId',
  },
  {
    target: 'Sales.status',
    values: Array.from(SALE_STATUSES).join(' | '),
    notes: 'PARTIALLY_REFUNDED tracks per-item refundedQuantity in SaleItems',
  },
  {
    target: 'Sales.paymentStatus',
    values: Array.from(PAYMENT_STATUSES).join(' | '),
    notes: 'PAID, PARTIAL (credit/partial), PENDING, FAILED, REVERSED',
  },
  {
    target: 'SalePayments.type',
    values: Array.from(SALE_PAYMENT_TYPES).join(' | '),
    notes: 'CHECKOUT = sale payment leg; DEBT_REPAYMENT = customer credit repayment',
  },
  {
    target: 'PurchaseOrders.paymentMethod',
    values: Array.from(PURCHASE_PAYMENT_METHODS).join(' | '),
    notes: 'CREDIT creates supplier Accounts Payable balance (dueAmount)',
  },
  {
    target: 'PurchaseOrders.status',
    values: Array.from(PURCHASE_STATUSES).join(' | '),
    notes: 'RECEIVED = stock added; CANCELLED = PO reversed',
  },
  {
    target: 'StockMovements.type',
    values: Array.from(MOVEMENT_TYPES).join(' | '),
    notes: 'IN (stock in/PO), OUT (sale/damage), ADJUSTMENT (stocktake), RETURN (refund)',
  },
  {
    target: 'Shifts.status',
    values: Array.from(SHIFT_STATUSES).join(' | '),
    notes: 'CLOSED shifts must include closedAt; OPEN shifts must leave closedAt blank',
  },
  {
    target: 'CashDrawerMovements.type',
    values: Array.from(CASH_MOVEMENT_TYPES).join(' | '),
    notes: 'REFUND/VOID amounts are negative; PAID_OUT may be negative outflow',
  },
  {
    target: 'SaleAdjustments.type',
    values: Array.from(ADJUSTMENT_TYPES).join(' | '),
    notes: 'Approver audit records for REFUND, PARTIAL_REFUND, and VOID',
  },
];
