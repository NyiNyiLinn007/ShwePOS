/** User role type. */
export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

/** Payment methods accepted by ShwePOS. */
export const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash', labelMm: 'ငွေသား', icon: '💵' },
  { value: 'CARD', label: 'Card', labelMm: 'ကတ်', icon: '💳' },
  { value: 'MOBILE_BANKING', label: 'Mobile Banking', labelMm: 'မိုဘိုင်းဘဏ်', icon: '📱' },
  { value: 'CREDIT', label: 'Credit', labelMm: 'အကြွေး', icon: '📋' },
] as const;

/** Product measurement units. */
export const PRODUCT_UNITS = [
  { value: 'pcs', label: 'Pieces', labelMm: 'ခု' },
  { value: 'kg', label: 'Kilogram', labelMm: 'ကီလိုဂရမ်' },
  { value: 'g', label: 'Gram', labelMm: 'ဂရမ်' },
  { value: 'liter', label: 'Liter', labelMm: 'လီတာ' },
  { value: 'ml', label: 'Milliliter', labelMm: 'မီလီလီတာ' },
  { value: 'pack', label: 'Pack', labelMm: 'ထုပ်' },
  { value: 'box', label: 'Box', labelMm: 'ဘူး' },
  { value: 'bottle', label: 'Bottle', labelMm: 'ပုလင်း' },
  { value: 'dozen', label: 'Dozen', labelMm: 'ဒါဇင်' },
  { value: 'set', label: 'Set', labelMm: 'စုံ' },
] as const;

/** User roles in the system. */
export const USER_ROLES = [
  { value: 'ADMIN', label: 'Admin', labelMm: 'အက်ဒမင်' },
  { value: 'MANAGER', label: 'Manager', labelMm: 'မန်နေဂျာ' },
  { value: 'CASHIER', label: 'Cashier', labelMm: 'ငွေကိုင်' },
] as const;

/** Stock movement types. */
export const STOCK_MOVEMENT_TYPES = [
  { value: 'IN', label: 'Stock In', labelMm: 'ပစ္စည်းဝင်', icon: '📥' },
  { value: 'OUT', label: 'Stock Out', labelMm: 'ပစ္စည်းထုတ်', icon: '📤' },
  { value: 'ADJUSTMENT', label: 'Adjustment', labelMm: 'ညှိနှိုင်းခြင်း', icon: '🔄' },
  { value: 'RETURN', label: 'Return', labelMm: 'ပြန်လည်လက်ခံ', icon: '↩️' },
] as const;

/** Expense categories. */
export const EXPENSE_CATEGORY_VALUES = [
  'Rent',
  'Utilities',
  'Salary',
  'Supplies',
  'Maintenance',
  'Transport',
  'Marketing',
  'Food',
  'Insurance',
  'Tax',
  'Other',
] as const;

export type ExpenseCategory = typeof EXPENSE_CATEGORY_VALUES[number];

export const EXPENSE_CATEGORIES = [
  { value: 'Rent', label: 'Rent', labelMm: 'အခန်းခ' },
  { value: 'Utilities', label: 'Utilities', labelMm: 'ရေ/မီး' },
  { value: 'Salary', label: 'Salary', labelMm: 'လစာ' },
  { value: 'Supplies', label: 'Supplies', labelMm: 'ကုန်ပစ္စည်းများ' },
  { value: 'Maintenance', label: 'Maintenance', labelMm: 'ပြုပြင်ထိန်းသိမ်းစရိတ်' },
  { value: 'Transport', label: 'Transport', labelMm: 'သယ်ယူပို့ဆောင်ရေး' },
  { value: 'Marketing', label: 'Marketing', labelMm: 'စျေးကွက်ရှာဖွေရေး' },
  { value: 'Food', label: 'Food & Beverages', labelMm: 'အစားအသောက်' },
  { value: 'Insurance', label: 'Insurance', labelMm: 'အာမခံ' },
  { value: 'Tax', label: 'Tax', labelMm: 'အခွန်' },
  { value: 'Other', label: 'Other', labelMm: 'အခြား' },
] satisfies ReadonlyArray<{ value: ExpenseCategory; label: string; labelMm: string }>;

/** Sale statuses. */
export const SALE_STATUSES = [
  { value: 'COMPLETED', label: 'Completed', labelMm: 'ပြီးဆုံး' },
  { value: 'REFUNDED', label: 'Refunded', labelMm: 'ပြန်အမ်းပြီး' },
  { value: 'VOIDED', label: 'Voided', labelMm: 'ပယ်ဖျက်ပြီး' },
] as const;

/** Sidebar section types. */
export type NavSection = 'main' | 'management' | 'analytics';

/** Sidebar section labels. */
export const SECTION_LABELS: Record<NavSection, { en: string; mm: string }> = {
  main: { en: 'Main', mm: 'အဓိက' },
  management: { en: 'Management', mm: 'စီမံခန့်ခွဲမှု' },
  analytics: { en: 'Analytics', mm: 'စိစစ်ချက်များ' },
};

/** Navigation items for the sidebar. `roles` restricts visibility. */
export const NAV_ITEMS = [
  {
    key: 'dashboard',
    path: '/',
    href: '/',
    label: 'Dashboard',
    labelMm: 'ဒက်ရှ်ဘုတ်',
    icon: '📊',
    section: 'main' as NavSection,
    roles: ['ADMIN', 'MANAGER', 'CASHIER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'pos',
    path: '/pos',
    href: '/pos',
    label: 'Point of Sale',
    labelMm: 'အရောင်းစက်',
    icon: '🛒',
    section: 'main' as NavSection,
    roles: ['ADMIN', 'MANAGER', 'CASHIER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'products',
    path: '/products',
    href: '/products',
    label: 'Products',
    labelMm: 'ကုန်ပစ္စည်းများ',
    icon: '📦',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'categories',
    path: '/categories',
    href: '/categories',
    label: 'Categories',
    labelMm: 'အမျိုးအစားများ',
    icon: '🏷️',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'inventory',
    path: '/inventory',
    href: '/inventory',
    label: 'Inventory',
    labelMm: 'ကုန်ပစ္စည်းစာရင်း',
    icon: '📋',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: true,
  },
  {
    key: 'sales',
    path: '/sales',
    href: '/sales',
    label: 'Sales',
    labelMm: 'အရောင်းများ',
    icon: '💰',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'customers',
    path: '/customers',
    href: '/customers',
    label: 'Customers',
    labelMm: 'ဖောက်သည်များ',
    icon: '👥',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'expenses',
    path: '/expenses',
    href: '/expenses',
    label: 'Expenses',
    labelMm: 'ကုန်ကျစရိတ်များ',
    icon: '💸',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'reports',
    path: '/reports',
    href: '/reports',
    label: 'Reports',
    labelMm: 'အစီရင်ခံစာများ',
    icon: '📈',
    section: 'analytics' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'users',
    path: '/users',
    href: '/users',
    label: 'Users',
    labelMm: 'အသုံးပြုသူများ',
    icon: '👤',
    section: 'analytics' as NavSection,
    roles: ['ADMIN'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'settings',
    path: '/settings',
    href: '/settings',
    label: 'Settings',
    labelMm: 'ဆက်တင်များ',
    icon: '⚙️',
    section: 'analytics' as NavSection,
    roles: ['ADMIN'] as UserRole[],
    hasBadge: false,
  },
];

/** Default pagination page sizes. */
export const PAGE_SIZES = [10, 25, 50, 100] as const;

/** App name. */
export const APP_NAME = 'ShwePOS';
export const APP_NAME_MM = 'ရွှေPOS';

/** Currency settings. */
export const CURRENCY_SYMBOL = 'K';
export const CURRENCY_CODE = 'MMK';
