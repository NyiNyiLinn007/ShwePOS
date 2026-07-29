'use client';

import { useAppStore } from '@/lib/store';

export type Language = 'en' | 'mm';

export type TranslationEntry = {
  en: string;
  mm: string;
};

type TranslationKeys = Record<string, TranslationEntry>;

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
  deactivate: { en: 'Deactivate', mm: 'ပိတ်ထားရန်' },
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
  totalSales: { en: 'Total Sales', mm: 'စုစုပေါင်းအရောင်း' },
  totalOrders: { en: 'Total Orders', mm: 'စုစုပေါင်းအော်ဒါများ' },
  order: { en: 'order', mm: 'အော်ဒါ' },
  items: { en: 'Items', mm: 'ပစ္စည်းများ' },
  itemUnit: { en: 'item', mm: 'ခု' },
  units: { en: 'units', mm: 'ခု' },
  lowStockItems: { en: 'Low Stock Items', mm: 'လက်ကျန်နည်းသောပစ္စည်းများ' },
  allGood: { en: 'All good', mm: 'အခြေအနေကောင်းပါသည်' },
  customer: { en: 'Customer', mm: 'ဖောက်သည်' },
  payment: { en: 'Payment', mm: 'ငွေပေးချေမှု' },
  time: { en: 'Time', mm: 'အချိန်' },
  walkIn: { en: 'Walk-in', mm: 'ဆိုင်လာဖောက်သည်' },
  cartEmpty: { en: 'Cart is empty', mm: 'ခြင်းတောင်းထဲတွင် ပစ္စည်းမရှိပါ' },
  searchCustomerFields: { en: 'Search by name, phone, email...', mm: 'အမည်၊ ဖုန်း၊ အီးမေးလ်ဖြင့် ရှာပါ...' },
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
  main: { en: 'Main', mm: 'အဓိက' },
  management: { en: 'Management', mm: 'စီမံခန့်ခွဲမှု' },
  analytics: { en: 'Analytics', mm: 'ခွဲခြမ်းစိတ်ဖြာမှု' },
  openNavigation: { en: 'Open navigation', mm: 'လမ်းညွှန်မီနူးဖွင့်ရန်' },
  closeNavigation: { en: 'Close navigation', mm: 'လမ်းညွှန်မီနူးပိတ်ရန်' },
  toggleSidebar: { en: 'Toggle sidebar', mm: 'ဘေးမီနူးပြောင်းရန်' },
  switchToLight: { en: 'Switch to light mode', mm: 'အလင်းမုဒ်သို့ ပြောင်းရန်' },
  switchToDark: { en: 'Switch to dark mode', mm: 'အမှောင်မုဒ်သို့ ပြောင်းရန်' },
  lightMode: { en: 'Light mode', mm: 'အလင်းမုဒ်' },
  darkMode: { en: 'Dark mode', mm: 'အမှောင်မုဒ်' },
  signOut: { en: 'Sign out', mm: 'ထွက်မည်' },

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
  openCart: { en: 'Open cart', mm: 'ခြင်းတောင်းဖွင့်ရန်' },
  viewOrder: { en: 'View order', mm: 'အော်ဒါကြည့်ရန်' },
  decreaseQuantity: { en: 'Decrease quantity', mm: 'အရေအတွက်လျှော့ရန်' },
  increaseQuantity: { en: 'Increase quantity', mm: 'အရေအတွက်တိုးရန်' },
  removeItem: { en: 'Remove item', mm: 'ပစ္စည်းဖယ်ရှားရန်' },
  exitPos: { en: 'Exit POS', mm: 'POS မှ ထွက်ရန်' },
  searchProducts: { en: 'Search by product, SKU or barcode', mm: 'ကုန်ပစ္စည်း၊ SKU သို့မဟုတ် ဘားကုတ်ဖြင့် ရှာပါ' },
  clearProductSearch: { en: 'Clear product search', mm: 'ကုန်ပစ္စည်းရှာဖွေမှု ရှင်းလင်းရန်' },
  posShortcuts: { en: 'POS shortcuts and availability', mm: 'POS ဖြတ်လမ်းများနှင့် ရရှိနိုင်မှု' },
  productCategories: { en: 'Product categories', mm: 'ကုန်ပစ္စည်းအမျိုးအစားများ' },
  hideUnavailable: { en: 'Hide unavailable', mm: 'မရနိုင်သောပစ္စည်းများ ဖျောက်ရန်' },
  showUnavailable: { en: 'Show unavailable', mm: 'မရနိုင်သောပစ္စည်းများ ပြရန်' },

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
  networkError: { en: 'Network error', mm: 'ကွန်ရက်ချို့ယွင်းချက်' },
  failedLoadUsers: { en: 'Failed to load users', mm: 'အသုံးပြုသူများကို ဖတ်၍မရပါ' },
  userDeactivated: { en: 'User deactivated', mm: 'အသုံးပြုသူကို ပိတ်ထားပြီးပါပြီ' },
  saveFailed: { en: 'Failed to save', mm: 'သိမ်းဆည်း၍ မရပါ' },
  saveUserFailed: { en: 'Failed to save user', mm: 'အသုံးပြုသူကို သိမ်းဆည်း၍ မရပါ' },
  deactivateUserFailed: { en: 'Failed to deactivate user', mm: 'အသုံးပြုသူကို ပိတ်၍ မရပါ' },
  importNetworkError: { en: 'Network error while importing data', mm: 'ဒေတာသွင်းယူစဉ် ကွန်ရက်ချို့ယွင်းချက် ဖြစ်ပွားပါသည်' },
  loading: { en: 'Loading...', mm: 'ဖတ်နေသည်...' },
  noData: { en: 'No data found', mm: 'ဒေတာမရှိပါ' },
  required: { en: 'This field is required', mm: 'ဤအကွက်ဖြည့်ရန်လိုအပ်သည်' },
  welcome: { en: 'Welcome', mm: 'ကြိုဆိုပါသည်' },
  saleCompleted: { en: 'Sale completed successfully!', mm: 'အရောင်းအောင်မြင်စွာပြီးဆုံးပါပြီ!' },
  saleDetails: { en: 'Sale Details', mm: 'အရောင်းအသေးစိတ်' },
  outOfStock: { en: 'Out of stock', mm: 'ကုန်ပစ္စည်းကုန်သွားပါပြီ' },
  lowStock: { en: 'Low stock', mm: 'ကုန်ပစ္စည်းနည်းနေသည်' },
  inStock: { en: 'In stock', mm: 'လက်ကျန်ရှိ' },

  // ── Inventory ───────────────────────────────────────────────
  stockIn: { en: 'Stock In', mm: 'ပစ္စည်းဝင်' },
  stockOut: { en: 'Stock Out', mm: 'ပစ္စည်းထုတ်' },
  adjustment: { en: 'Adjustment', mm: 'ညှိနှိုင်းခြင်း' },
  returnStock: { en: 'Return', mm: 'ပြန်လည်လက်ခံ' },
  reason: { en: 'Reason', mm: 'အကြောင်းပြချက်' },
  previousStock: { en: 'Previous Stock', mm: 'ယခင်လက်ကျန်' },
  newStock: { en: 'New Stock', mm: 'လက်ကျန်အသစ်' },

  // ── Customer ────────────────────────────────────────────────
  loyaltyPoints: { en: 'Loyalty Points', mm: 'အမှတ်များ' },
  totalPurchases: { en: 'Total Purchases', mm: 'စုစုပေါင်းဝယ်ယူမှု' },
  purchaseHistory: { en: 'Purchase History', mm: 'ဝယ်ယူမှုမှတ်တမ်း' },
  expenseRent: { en: 'Rent', mm: 'အခန်းခ' },
  expenseUtilities: { en: 'Utilities', mm: 'ရေ/မီး' },
  expenseSalary: { en: 'Salary', mm: 'လစာ' },
  expenseSupplies: { en: 'Supplies', mm: 'အသုံးအဆောင်ပစ္စည်းများ' },
  expenseMaintenance: { en: 'Maintenance', mm: 'ပြုပြင်ထိန်းသိမ်းစရိတ်' },
  expenseTransport: { en: 'Transport', mm: 'သယ်ယူပို့ဆောင်ရေး' },
  expenseMarketing: { en: 'Marketing', mm: 'ဈေးကွက်ရှာဖွေရေး' },
  expenseFood: { en: 'Food & Beverages', mm: 'အစားအသောက်' },
  expenseInsurance: { en: 'Insurance', mm: 'အာမခံ' },
  expenseTax: { en: 'Tax', mm: 'အခွန်' },
  expenseOther: { en: 'Other', mm: 'အခြား' },

  // ── Authentication ────────────────────────────────────────
  loginSubtitle: { en: 'Enterprise Point of Sale System', mm: 'လုပ်ငန်းသုံး အရောင်းစီမံခန့်ခွဲမှုစနစ်' },
  invalidCredentials: { en: 'Invalid email or password. Please try again.', mm: 'အီးမေးလ် သို့မဟုတ် စကားဝှက် မမှန်ပါ။ ထပ်မံကြိုးစားပါ။' },
  unexpectedError: { en: 'An unexpected error occurred. Please try again.', mm: 'မမျှော်လင့်ထားသော အမှားဖြစ်ပွားပါသည်။ ထပ်မံကြိုးစားပါ။' },
  enterCredentials: { en: 'Please enter both email and password.', mm: 'အီးမေးလ်နှင့် စကားဝှက် နှစ်ခုလုံးထည့်ပါ။' },
  activeSessionDetected: { en: 'Active session detected', mm: 'လက်ရှိဝင်ရောက်ထားသော session တွေ့ရှိပါသည်' },
  activeSessionLineOne: { en: 'This account is signed in on another device or browser.', mm: 'ဤအကောင့်ကို အခြားစက် သို့မဟုတ် browser တွင် ဝင်ရောက်ထားပါသည်။' },
  activeSessionLineTwo: { en: 'Continuing will sign out the previous session.', mm: 'ဆက်ဝင်ပါက ယခင် session မှ အလိုအလျောက် ထွက်သွားပါမည်။' },
  cancelLogin: { en: 'Cancel', mm: 'ပယ်ဖျက်ရန်' },
  continueLogin: { en: 'Continue', mm: 'ဆက်ဝင်ရန်' },
  signingIn: { en: 'Signing in...', mm: 'ဝင်ရောက်နေသည်...' },
  emailAddress: { en: 'Email address', mm: 'အီးမေးလ်လိပ်စာ' },
  enterPassword: { en: 'Enter your password', mm: 'စကားဝှက်ထည့်ပါ' },
  signIn: { en: 'Sign in', mm: 'ဝင်ရောက်ရန်' },

  // ── User Roles ──────────────────────────────────────────────
  admin: { en: 'Admin', mm: 'အက်ဒမင်' },
  manager: { en: 'Manager', mm: 'မန်နေဂျာ' },
  cashier: { en: 'Cashier', mm: 'ငွေကိုင်' },

  // ── Cashier Shift ───────────────────────────────────────────
  shifts: { en: 'Cashier Shifts', mm: 'ငွေကိုင်အလုပ်ချိန်များ' },
  cashierShift: { en: 'Cashier Shift', mm: 'ငွေကိုင်အလုပ်ချိန်' },
  openShift: { en: 'Open shift', mm: 'အလုပ်ချိန်ဖွင့်ရန်' },
  closeShift: { en: 'Close shift', mm: 'အလုပ်ချိန်ပိတ်ရန်' },
  openYourShift: { en: 'Open your cashier shift', mm: 'သင့်ငွေကိုင်အလုပ်ချိန်ကို ဖွင့်ပါ' },
  currentCashDrawer: { en: 'Current cash drawer', mm: 'လက်ရှိငွေသေတ္တာ' },
  openingCash: { en: 'Opening cash', mm: 'အဖွင့်ငွေ' },
  actualCash: { en: 'Actual cash counted', mm: 'ရေတွက်ရရှိငွေ' },
  expectedCash: { en: 'Expected cash', mm: 'မျှော်မှန်းငွေ' },
  cashSales: { en: 'Cash sales', mm: 'လက်ငင်းငွေအရောင်း' },
  variance: { en: 'Variance', mm: 'ငွေကွာဟချက်' },
  over: { en: 'over', mm: 'ပိုငွေ' },
  short: { en: 'short', mm: 'လိုငွေ' },
  openStatus: { en: 'Open', mm: 'ဖွင့်ထားသည်' },
  closedStatus: { en: 'Closed', mm: 'ပိတ်ထားသည်' },
  loadingShift: { en: 'Loading shift…', mm: 'အလုပ်ချိန်ကို ဖတ်နေသည်…' },
  balanced: { en: 'Balanced', mm: 'ငွေကိုက်ညီသည်' },
  shiftHistory: { en: 'Shift history', mm: 'အလုပ်ချိန်မှတ်တမ်း' },
  shiftOpened: { en: 'Cashier shift opened', mm: 'ငွေကိုင်အလုပ်ချိန် ဖွင့်ပြီးပါပြီ' },
  shiftClosed: { en: 'Cashier shift closed', mm: 'ငွေကိုင်အလုပ်ချိန် ပိတ်ပြီးပါပြီ' },
  cashShiftRequired: { en: 'Open a cashier shift before accepting cash', mm: 'လက်ငင်းငွေလက်ခံရန် ငွေကိုင်အလုပ်ချိန်ကို အရင်ဖွင့်ပါ' },
  cashShiftRequiredPayment: { en: 'Cash payments require an open cashier shift.', mm: 'လက်ငင်းငွေပေးချေရန် ငွေကိုင်အလုပ်ချိန် ဖွင့်ထားရပါမည်။' },
  paymentReference: { en: 'Payment Reference', mm: 'ငွေပေးချေမှုအညွှန်း' },
  transactionCode: { en: 'Transaction ID or approval code...', mm: 'ငွေလွှဲအမှတ် သို့မဟုတ် အတည်ပြုကုဒ်...' },
  reasonRequired: { en: 'Reason is required', mm: 'အကြောင်းပြချက်ထည့်ရန်လိုပါသည်' },
  reasonLabel: { en: 'Reason', mm: 'အကြောင်းပြချက်' },
  enterReason: { en: 'Enter refund or void reason...', mm: 'ပြန်အမ်းခြင်း သို့မဟုတ် ပယ်ဖျက်ခြင်းအကြောင်းပြချက် ထည့်ပါ...' },
  dataMigration: { en: 'Data Migration', mm: 'ဒေတာပြောင်းရွှေ့ခြင်း' },
  downloadTemplate: { en: 'Download template', mm: 'Template ဒေါင်းလုဒ်ရယူရန်' },
  fillExcel: { en: 'Fill Excel', mm: 'Excel ဖြည့်ရန်' },
  chooseFile: { en: 'Choose file', mm: 'ဖိုင်ရွေးရန်' },
  importReview: { en: 'Import & review', mm: 'သွင်းယူပြီး ရလဒ်စစ်ဆေးရန်' },
  downloadExcelTemplate: { en: 'Download Excel Template', mm: 'Excel Template ဒေါင်းလုဒ်ရယူရန်' },
  exportAllData: { en: 'Export All Data', mm: 'ဒေတာအားလုံး ထုတ်ယူရန်' },
  chooseExcelFile: { en: 'Choose Excel File', mm: 'Excel ဖိုင်ရွေးရန်' },
  importing: { en: 'Importing...', mm: 'ဒေတာသွင်းယူနေသည်...' },
  importData: { en: 'Import Data', mm: 'ဒေတာသွင်းယူရန်' },
  cashShiftOpen: { en: 'Cashier shift open · Cash payments enabled', mm: 'ငွေကိုင်အလုပ်ချိန် ဖွင့်ထားသည် · လက်ငင်းငွေလက်ခံနိုင်ပါသည်' },
  checkingShift: { en: 'Checking cashier shift…', mm: 'ငွေကိုင်အလုပ်ချိန် စစ်ဆေးနေသည်…' },
  openPos: { en: 'Open POS', mm: 'POS ဖွင့်ရန်' },
  continueSelling: { en: 'Continue selling', mm: 'အရောင်းဆက်လုပ်ရန်' },
  transactions: { en: 'Transactions', mm: 'လုပ်ဆောင်ချက်များ' },
  allCashierShifts: { en: 'All cashier shifts', mm: 'ငွေကိုင်အားလုံး၏ အလုပ်ချိန်များ' },
  recentShifts: { en: 'Your recent shifts', mm: 'သင့်လတ်တလော အလုပ်ချိန်များ' },
  noShiftHistory: { en: 'No shift history yet', mm: 'အလုပ်ချိန်မှတ်တမ်း မရှိသေးပါ' },
  shiftSubtitle: { en: 'Open, reconcile, and close your cash drawer safely.', mm: 'အဖွင့်ငွေ၊ ရောင်းရငွေနှင့် အပိတ်ငွေကို စစ်ဆေးစီမံပါ။' },
  opened: { en: 'Opened', mm: 'ဖွင့်ချိန်' },
  closed: { en: 'Closed', mm: 'ပိတ်ချိန်' },
  actual: { en: 'Actual', mm: 'အမှန်တကယ်' },
  statusLabel: { en: 'Status', mm: 'အခြေအနေ' },
  openingShift: { en: 'Opening…', mm: 'ဖွင့်နေသည်…' },
  closingShift: { en: 'Closing…', mm: 'ပိတ်နေသည်…' },
  confirmCloseShift: { en: 'Confirm close shift', mm: 'အလုပ်ချိန်ပိတ်မည်' },

  // ── Language & Accessibility ───────────────────────────────
  switchToMyanmar: { en: 'Switch to Myanmar', mm: 'မြန်မာဘာသာသို့ ပြောင်းရန်' },
  switchToEnglish: { en: 'Switch to English', mm: 'အင်္ဂလိပ်ဘာသာသို့ ပြောင်းရန်' },

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
export type TranslationKey = keyof typeof translations;

export function translate(language: Language, key: string, fallbackMm?: string): string {
  const entry = translations[key];
  if (entry) return entry[language] || entry.en || key;
  // Backward-compatible bridge for legacy components while their strings are migrated.
  return language === 'mm' ? (fallbackMm || key) : key;
}

export function useI18n() {
  const language = useAppStore((state) => state.language);

  const t = (key: string, fallbackMm?: string) => translate(language, key, fallbackMm);

  return { t, language };
}
