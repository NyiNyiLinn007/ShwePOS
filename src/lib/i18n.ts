'use client';

import { useAppStore } from '@/lib/store';

export type Language = 'en' | 'mm';

type TranslationKeys = {
  [key: string]: {
    en: string;
    mm: string;
  };
};

export const translations: TranslationKeys = {
  // ── Navigation & Pages ──────────────────────────────────────
  dashboard: { en: 'Dashboard', mm: 'ဒက်ရှ်ဘုတ်' },
  products: { en: 'Products', mm: 'ကုန်ပစ္စည်းများ' },
  categories: { en: 'Categories', mm: 'အမျိုးအစားများ' },
  inventory: { en: 'Inventory', mm: 'ကုန်ပစ္စည်းစာရင်း' },
  customers: { en: 'Customers', mm: 'ဖောက်သည်များ' },
  sales: { en: 'Sales', mm: 'အရောင်းများ' },
  reports: { en: 'Reports', mm: 'အစီရင်ခံစာများ' },
  expenses: { en: 'Expenses', mm: 'ကုန်ကျစရိတ်များ' },
  settings: { en: 'Settings', mm: 'ဆက်တင်များ' },
  pos: { en: 'Point of Sale', mm: 'အရောင်းစက်' },
  login: { en: 'Login', mm: 'ဝင်ရောက်ရန်' },
  logout: { en: 'Logout', mm: 'ထွက်ရန်' },
  register: { en: 'Register', mm: 'စာရင်းသွင်းရန်' },
  users: { en: 'Users', mm: 'အသုံးပြုသူများ' },
  stockMovements: { en: 'Stock Movements', mm: 'ကုန်ပစ္စည်းရွှေ့ပြောင်းမှုများ' },

  // ── Common Actions ──────────────────────────────────────────
  add: { en: 'Add', mm: 'ထည့်ရန်' },
  addNew: { en: 'Add New', mm: 'အသစ်ထည့်ရန်' },
  edit: { en: 'Edit', mm: 'ပြင်ဆင်ရန်' },
  delete: { en: 'Delete', mm: 'ဖျက်ရန်' },
  save: { en: 'Save', mm: 'သိမ်းရန်' },
  cancel: { en: 'Cancel', mm: 'ပယ်ဖျက်ရန်' },
  search: { en: 'Search', mm: 'ရှာဖွေရန်' },
  filter: { en: 'Filter', mm: 'စစ်ထုတ်ရန်' },
  export: { en: 'Export', mm: 'ထုတ်ယူရန်' },
  import: { en: 'Import', mm: 'သွင်းယူရန်' },
  print: { en: 'Print', mm: 'ပရင့်ထုတ်ရန်' },
  refresh: { en: 'Refresh', mm: 'ပြန်လည်ရယူရန်' },
  view: { en: 'View', mm: 'ကြည့်ရန်' },
  back: { en: 'Back', mm: 'နောက်သို့' },
  next: { en: 'Next', mm: 'ရှေ့သို့' },
  confirm: { en: 'Confirm', mm: 'အတည်ပြုရန်' },
  close: { en: 'Close', mm: 'ပိတ်ရန်' },
  submit: { en: 'Submit', mm: 'တင်သွင်းရန်' },
  update: { en: 'Update', mm: 'အပ်ဒိတ်လုပ်ရန်' },
  reset: { en: 'Reset', mm: 'ပြန်လည်သတ်မှတ်ရန်' },
  clear: { en: 'Clear', mm: 'ရှင်းလင်းရန်' },

  // ── Common Labels ───────────────────────────────────────────
  name: { en: 'Name', mm: 'အမည်' },
  email: { en: 'Email', mm: 'အီးမေးလ်' },
  phone: { en: 'Phone', mm: 'ဖုန်းနံပါတ်' },
  password: { en: 'Password', mm: 'စကားဝှက်' },
  address: { en: 'Address', mm: 'လိပ်စာ' },
  description: { en: 'Description', mm: 'ဖော်ပြချက်' },
  date: { en: 'Date', mm: 'ရက်စွဲ' },
  status: { en: 'Status', mm: 'အခြေအနေ' },
  actions: { en: 'Actions', mm: 'လုပ်ဆောင်ချက်များ' },
  total: { en: 'Total', mm: 'စုစုပေါင်း' },
  subtotal: { en: 'Subtotal', mm: 'ပေါင်းတန်ဖိုး' },
  discount: { en: 'Discount', mm: 'လျှော့ဈေး' },
  tax: { en: 'Tax', mm: 'အခွန်' },
  amount: { en: 'Amount', mm: 'ပမာဏ' },
  quantity: { en: 'Quantity', mm: 'အရေအတွက်' },
  price: { en: 'Price', mm: 'ဈေးနှုန်း' },
  costPrice: { en: 'Cost Price', mm: 'ကုန်ကျစရိတ်' },
  sellingPrice: { en: 'Selling Price', mm: 'ရောင်းဈေး' },
  stock: { en: 'Stock', mm: 'လက်ကျန်' },
  category: { en: 'Category', mm: 'အမျိုးအစား' },
  unit: { en: 'Unit', mm: 'ယူနစ်' },
  barcode: { en: 'Barcode', mm: 'ဘားကုတ်' },
  sku: { en: 'SKU', mm: 'SKU' },
  image: { en: 'Image', mm: 'ပုံ' },
  notes: { en: 'Notes', mm: 'မှတ်ချက်များ' },
  active: { en: 'Active', mm: 'အသုံးပြုနေဆဲ' },
  inactive: { en: 'Inactive', mm: 'ပိတ်ထားသည်' },
  role: { en: 'Role', mm: 'ရာထူး' },
  all: { en: 'All', mm: 'အားလုံး' },

  // ── POS ─────────────────────────────────────────────────────
  cart: { en: 'Cart', mm: 'ခြင်းတောင်း' },
  checkout: { en: 'Checkout', mm: 'ငွေရှင်းရန်' },
  paymentMethod: { en: 'Payment Method', mm: 'ငွေပေးချေမှုနည်းလမ်း' },
  cash: { en: 'Cash', mm: 'ငွေသား' },
  card: { en: 'Card', mm: 'ကတ်' },
  mobileBanking: { en: 'Mobile Banking', mm: 'မိုဘိုင်းဘဏ်' },
  credit: { en: 'Credit', mm: 'အကြွေး' },
  paidAmount: { en: 'Paid Amount', mm: 'ပေးငွေ' },
  changeAmount: { en: 'Change', mm: 'ပြန်အမ်းငွေ' },
  invoiceNumber: { en: 'Invoice No.', mm: 'ပြေစာအမှတ်' },
  receipt: { en: 'Receipt', mm: 'ပြေစာ' },
  newSale: { en: 'New Sale', mm: 'အရောင်းအသစ်' },
  completeSale: { en: 'Complete Sale', mm: 'အရောင်းပြီးမြောက်ရန်' },
  holdSale: { en: 'Hold Sale', mm: 'ခဏထားရန်' },
  voidSale: { en: 'Void Sale', mm: 'ပယ်ဖျက်ရန်' },
  refund: { en: 'Refund', mm: 'ပြန်အမ်းငွေ' },
  noItems: { en: 'No items in cart', mm: 'ခြင်းတောင်းထဲတွင် ပစ္စည်းမရှိပါ' },
  scanBarcode: { en: 'Scan barcode or search product', mm: 'ဘားကုတ်ဖတ်ရန် သို့မဟုတ် ကုန်ပစ္စည်းရှာရန်' },

  // ── Dashboard ───────────────────────────────────────────────
  todaySales: { en: "Today's Sales", mm: 'ယနေ့အရောင်း' },
  todayRevenue: { en: "Today's Revenue", mm: 'ယနေ့ဝင်ငွေ' },
  totalProducts: { en: 'Total Products', mm: 'ကုန်ပစ္စည်းစုစုပေါင်း' },
  totalCustomers: { en: 'Total Customers', mm: 'ဖောက်သည်စုစုပေါင်း' },
  lowStockAlert: { en: 'Low Stock Alert', mm: 'ကုန်ပစ္စည်းနည်းနေပါသည်' },
  recentSales: { en: 'Recent Sales', mm: 'မကြာမီကအရောင်းများ' },
  salesOverview: { en: 'Sales Overview', mm: 'အရောင်းခြုံငုံသုံးသပ်ချက်' },
  topProducts: { en: 'Top Products', mm: 'ထိပ်တန်းကုန်ပစ္စည်းများ' },
  monthlySales: { en: 'Monthly Sales', mm: 'လစဉ်အရောင်း' },
  weeklySales: { en: 'Weekly Sales', mm: 'အပတ်စဉ်အရောင်း' },

  // ── Reports ─────────────────────────────────────────────────
  salesReport: { en: 'Sales Report', mm: 'အရောင်းအစီရင်ခံစာ' },
  inventoryReport: { en: 'Inventory Report', mm: 'ကုန်ပစ္စည်းအစီရင်ခံစာ' },
  expenseReport: { en: 'Expense Report', mm: 'ကုန်ကျစရိတ်အစီရင်ခံစာ' },
  profitLoss: { en: 'Profit & Loss', mm: 'အမြတ်အရှုံး' },
  dateRange: { en: 'Date Range', mm: 'ရက်စွဲအပိုင်းအခြား' },
  startDate: { en: 'Start Date', mm: 'စတင်ရက်' },
  endDate: { en: 'End Date', mm: 'ကုန်ဆုံးရက်' },
  today: { en: 'Today', mm: 'ယနေ့' },
  thisWeek: { en: 'This Week', mm: 'ဤအပတ်' },
  thisMonth: { en: 'This Month', mm: 'ဤလ' },
  thisYear: { en: 'This Year', mm: 'ဤနှစ်' },

  // ── Settings ────────────────────────────────────────────────
  businessName: { en: 'Business Name', mm: 'လုပ်ငန်းအမည်' },
  language: { en: 'Language', mm: 'ဘာသာစကား' },
  taxRate: { en: 'Tax Rate', mm: 'အခွန်နှုန်း' },
  currency: { en: 'Currency', mm: 'ငွေကြေးအမျိုးအစား' },
  receiptSettings: { en: 'Receipt Settings', mm: 'ပြေစာဆက်တင်များ' },
  general: { en: 'General', mm: 'အထွေထွေ' },

  // ── Messages ────────────────────────────────────────────────
  saveSuccess: { en: 'Saved successfully', mm: 'အောင်မြင်စွာသိမ်းဆည်းပြီး' },
  deleteSuccess: { en: 'Deleted successfully', mm: 'အောင်မြင်စွာဖျက်ပြီး' },
  deleteConfirm: { en: 'Are you sure you want to delete?', mm: 'ဖျက်ရန် သေချာပါသလား?' },
  error: { en: 'An error occurred', mm: 'အမှားတစ်ခုဖြစ်ပွားခဲ့သည်' },
  loading: { en: 'Loading...', mm: 'ဖွင့်နေသည်...' },
  noData: { en: 'No data found', mm: 'ဒေတာမရှိပါ' },
  required: { en: 'This field is required', mm: 'ဤအကွက်ဖြည့်ရန်လိုအပ်သည်' },
  welcome: { en: 'Welcome', mm: 'ကြိုဆိုပါတယ်' },
  saleCompleted: { en: 'Sale completed successfully!', mm: 'အရောင်းအောင်မြင်စွာပြီးဆုံးပါပြီ!' },
  outOfStock: { en: 'Out of stock', mm: 'ကုန်ပစ္စည်းကုန်သွားပါပြီ' },
  lowStock: { en: 'Low stock', mm: 'ကုန်ပစ္စည်းနည်းနေသည်' },
  inStock: { en: 'In stock', mm: 'လက်ကျန်ရှိ' },

  // ── Inventory ───────────────────────────────────────────────
  stockIn: { en: 'Stock In', mm: 'ပစ္စည်းဝင်' },
  stockOut: { en: 'Stock Out', mm: 'ပစ္စည်းထုတ်' },
  adjustment: { en: 'Adjustment', mm: 'ညှိနှိုင်းခြင်း' },
  returnStock: { en: 'Return', mm: 'ပြန်လည်လက်ခံ' },
  reason: { en: 'Reason', mm: 'အကြောင်းအရင်း' },
  previousStock: { en: 'Previous Stock', mm: 'ယခင်လက်ကျန်' },
  newStock: { en: 'New Stock', mm: 'လက်ကျန်အသစ်' },

  // ── Customer ────────────────────────────────────────────────
  loyaltyPoints: { en: 'Loyalty Points', mm: 'အမှတ်များ' },
  totalPurchases: { en: 'Total Purchases', mm: 'စုစုပေါင်းဝယ်ယူမှု' },
  purchaseHistory: { en: 'Purchase History', mm: 'ဝယ်ယူမှုမှတ်တမ်း' },

  // ── User Roles ──────────────────────────────────────────────
  admin: { en: 'Admin', mm: 'အက်ဒမင်' },
  manager: { en: 'Manager', mm: 'မန်နေဂျာ' },
  cashier: { en: 'Cashier', mm: 'ငွေကိုင်' },

  // ── Sale Status ─────────────────────────────────────────────
  completed: { en: 'Completed', mm: 'ပြီးဆုံး' },
  refunded: { en: 'Refunded', mm: 'ပြန်အမ်းပြီး' },
  voided: { en: 'Voided', mm: 'ပယ်ဖျက်ပြီး' },
};

/**
 * Translation hook for bilingual (EN/MM) support.
 * Reads the current language from the app store.
 *
 * Usage:
 *   const { t, language } = useI18n();
 *   <span>{t('dashboard')}</span>
 */
export function useI18n() {
  const language = useAppStore((state) => state.language);

  function t(key: string): string {
    const entry = translations[key];
    if (!entry) return key;
    return entry[language] || entry.en || key;
  }

  return { t, language };
}
