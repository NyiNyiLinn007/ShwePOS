/** User role type. */
export type UserRole = 'ADMIN' | 'MANAGER' | 'CASHIER';

/** Payment methods accepted by ShwePOS. */
export const PAYMENT_METHODS = [
  { value: 'CASH', icon: '💵' },
  { value: 'CARD', icon: '💳' },
  { value: 'MOBILE_BANKING', icon: '📱' },
  { value: 'CREDIT', icon: '📋' },
] as const;

/** Product measurement units. */
export const PRODUCT_UNITS = [
  { value: 'pcs' },
  { value: 'kg' },
  { value: 'g' },
  { value: 'liter' },
  { value: 'ml' },
  { value: 'pack' },
  { value: 'box' },
  { value: 'bottle' },
  { value: 'dozen' },
  { value: 'set' },
] as const;

/** User roles in the system. */
export const USER_ROLES = [
  { value: 'ADMIN' },
  { value: 'MANAGER' },
  { value: 'CASHIER' },
] as const;

/** Stock movement types. */
export const STOCK_MOVEMENT_TYPES = [
  { value: 'IN', icon: '📥' },
  { value: 'OUT', icon: '📤' },
  { value: 'ADJUSTMENT', icon: '🔄' },
  { value: 'RETURN', icon: '↩️' },
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
  { value: 'Rent' },
  { value: 'Utilities' },
  { value: 'Salary' },
  { value: 'Supplies' },
  { value: 'Maintenance' },
  { value: 'Transport' },
  { value: 'Marketing' },
  { value: 'Food' },
  { value: 'Insurance' },
  { value: 'Tax' },
  { value: 'Other' },
] satisfies ReadonlyArray<{ value: ExpenseCategory }>;

/** Sale statuses. */
export const SALE_STATUSES = [
  { value: 'COMPLETED' },
  { value: 'REFUNDED' },
  { value: 'VOIDED' },
] as const;

/** Sidebar section types. */
export type NavSection = 'main' | 'management' | 'analytics';

/** Navigation items for the sidebar. `roles` restricts visibility. */
export const NAV_ITEMS = [
  {
    key: 'dashboard',
    path: '/',
    href: '/',
    icon: '📊',
    section: 'main' as NavSection,
    roles: ['ADMIN', 'MANAGER', 'CASHIER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'pos',
    path: '/pos',
    href: '/pos',
    icon: '🛒',
    section: 'main' as NavSection,
    roles: ['ADMIN', 'MANAGER', 'CASHIER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'shifts',
    path: '/shifts',
    href: '/shifts',
    icon: '▣',
    section: 'main' as NavSection,
    roles: ['ADMIN', 'MANAGER', 'CASHIER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'products',
    path: '/products',
    href: '/products',
    icon: '📦',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'categories',
    path: '/categories',
    href: '/categories',
    icon: '🏷️',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'inventory',
    path: '/inventory',
    href: '/inventory',
    icon: '📋',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: true,
  },
  {
    key: 'sales',
    path: '/sales',
    href: '/sales',
    icon: '💰',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'customers',
    path: '/customers',
    href: '/customers',
    icon: '👥',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'expenses',
    path: '/expenses',
    href: '/expenses',
    icon: '💸',
    section: 'management' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'reports',
    path: '/reports',
    href: '/reports',
    icon: '📈',
    section: 'analytics' as NavSection,
    roles: ['ADMIN', 'MANAGER'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'users',
    path: '/users',
    href: '/users',
    icon: '👤',
    section: 'analytics' as NavSection,
    roles: ['ADMIN'] as UserRole[],
    hasBadge: false,
  },
  {
    key: 'settings',
    path: '/settings',
    href: '/settings',
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
