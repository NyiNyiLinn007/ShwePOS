# ShwePOS — Project Architecture, Development Rules & Knowledge Base (`AGENTS.md`)

> **MANDATORY RULE FOR ALL DEVELOPERS & AI AGENTS (မဖြစ်မနေ လိုက်နာရမည့် အဓိက စည်းမျဉ်း):**
> 1. **Read First:** Before modifying any code, database schema, API route, or UI component in ShwePOS, you **MUST** read and follow all rules in this file (`AGENTS.md`).
> 2. **Always Update After Changes (ပြင်ဆင်မှုတိုင်းတွင် ဤဖိုင်ကို Update လုပ်ရန်):** Whenever you add a new feature, change business logic, modify Prisma schema/API routes, or update UI/UX conventions, you **MUST update this `AGENTS.md` file** (including the Architecture Map and Section 8 Living Changelog) in the same task/commit.

---

## 1. Project Overview & Tech Stack

**ShwePOS (ရွှေPOS)** is a production-ready, bilingual (English / Myanmar) Enterprise Retail Point of Sale (POS) system built for Myanmar retail stores, mini-marts, grocery shops, and pharmacies.

- **Framework:** Next.js `16.2.12` (App Router, Turbopack, Server & Client Components)
- **Language & Types:** TypeScript `6.x`, Zod `4.x` runtime validation
- **Database & ORM:** PostgreSQL (Neon Serverless `neondb`) with Prisma `6.19.3`
- **Authentication:** NextAuth v5 (`5.0.0-beta.32`, JWT session strategy with DB-backed `sessionVersion` revocation & rate limiting)
- **State Management:** Zustand `5.x` (`cartStore.ts`, `offlineQueueStore.ts`, `settingsStore.ts`, `store.ts`)
- **UI & Icons:** Enterprise CSS Design System (`src/app/globals.css`), `lucide-react` vector icons (`src/components/ui/Icons.tsx`), Recharts `3.x`
- **Excel Import/Export:** `read-excel-file` & `write-excel-file` (`src/lib/dataMigration.ts`)
- **Production URL:** `https://shwepos.vercel.app/`

---

## 2. Strict Architectural & Coding Rules (မဖြစ်မနေ လိုက်နာရမည့် စည်းမျဉ်းများ)

### Rule 1: Myanmar Timezone Standardization (`Asia/Yangon`, `UTC+6:30`)
- Vercel servers run in `UTC`. **NEVER** use raw `new Date().setHours(0, 0, 0, 0)` or server-local date methods for daily sales boundaries, invoice numbering, or report grouping.
- **ALWAYS** use the Myanmar timezone helpers in `src/lib/utils.ts`:
  - `getTodayRange()` — Returns UTC `Date` boundaries for `00:00:00.000` to `23:59:59.999` in `Asia/Yangon (UTC+6:30)`.
  - `parseMyanmarDateBoundary(dateStr, isEndOfDay)` — Parses `YYYY-MM-DD` strings into `UTC+6:30` start/end timestamps.
  - `getMyanmarDateCompact(date)` — Returns `YYYYMMDD` in Myanmar time (used for `INV-YYYYMMDD-XXXX` invoice numbers).
  - `getMyanmarDateKey(date)` & `getMyanmarHour(date)` — Used in `/api/reports` for daily and hourly sales buckets.
  - `formatDate`, `formatDateTime`, `formatTime`, `formatShortDate` — Explicitly pinned to `timeZone: 'Asia/Yangon'`.

### Rule 2: Database Precision, Decimal Handling & Migrations
- **Monetary Fields (`Decimal(18, 2)`):** All currency fields (`costPrice`, `sellingPrice`, `subtotal`, `discountAmount`, `taxAmount`, `totalAmount`, `paidAmount`, `changeAmount`, `dueAmount`, `creditBalance`, `creditLimit`, `openingCash`, `expectedCash`, `actualCash`, `variance`, `Expense.amount`) use `Decimal(18, 2)`.
- **Quantity Fields (`Decimal(18, 3)`):** All stock and sale quantities (`stockQuantity`, `lowStockThreshold`, `SaleItem.quantity`, `SaleItem.refundedQuantity`, `StockMovement.quantity`, `previousStock`, `newStock`) use `Decimal(18, 3)` to support fractional units (`kg`, `g`, `liter`, `ml`).
- **Serialization:** Always convert Prisma `Decimal` objects to plain JS `number` via `toNumber()` from `src/lib/number.ts` before passing data from Server Components to Client Components or returning JSON.
- **Vercel Build Safety:** Keep `package.json` `"build"` and `"vercel-build"` as `"prisma generate && next build"` (do NOT chain `prisma migrate deploy` inside Vercel build to avoid Neon pooler advisory lock timeouts). Apply schema migrations explicitly via `npx prisma migrate deploy`.

### Rule 3: Security, Authentication, CSRF & RBAC
- **API Route Protection:**
  - Every state-changing API route (`POST`, `PUT`, `DELETE`) **MUST** call `validateCsrf(request)` first.
  - Every API route **MUST** call `requireAuth()` or `requireRole([...])` from `src/lib/apiAuth.ts`.
  - Role hierarchy:
    - `ADMIN`: Full system access, User Management (`/users`), Settings (`/settings`), Excel Data Migration (`/api/data-migration`), Category/Product/Customer deletion.
    - `MANAGER`: Products, Categories, Inventory adjustments, Sales Void/Refund, Shifts override, Expenses, Reports.
    - `CASHIER`: POS Terminal (`/pos`), Cashier Shifts (`/shifts`), viewing Products/Inventory/Sales (scoped)/Customers.
- **Server Page Protection:** Every page under `src/app/(dashboard)/**/page.tsx` **MUST** call `requirePageAuth()` or `requirePageRole([...])` from `src/lib/pageAuth.ts`.
- **Session Revocation:** Whenever a user's `password`, `role`, or `isActive` status is updated (`src/app/api/users/[id]/route.ts`), you **MUST** increment `sessionVersion: { increment: 1 }` and call `invalidateSessionCache(id)`.
- **Edge Proxy (`src/proxy.ts`):** Keep `src/proxy.ts` lightweight (import `authConfig` only, never Prisma or `bcryptjs`). Any public static asset in `public/` (e.g., `logo.png`, `manifest.json`) must be listed in the `matcher` exclusion regex in `src/proxy.ts`.

### Rule 4: Core POS Business Logic & Accounting Invariants
- **Cashier Shift & Cash Drawer Control:**
  - Any `CASH` sale or cash leg inside a `SPLIT` sale requires an active `OPEN` shift for the cashier (`409 Conflict` if no open shift).
  - Paid-In (`PAID_IN`) and Paid-Out (`PAID_OUT`) drawer movements are recorded via `POST /api/shifts/[id]/movements`.
  - `expectedCash` formula: `openingCash + cashSales + paidIn - paidOut - cashRefunds`.
  - Closing a shift (`POST /api/shifts/[id]/close`) records `actualCash`, computes `variance = actualCash - expectedCash`, and triggers the thermal **Shift Z-Report**.
- **Checkout, Split Payments, Credit (အကြွေး) & Loyalty Points:**
  - Supported `PAYMENT_METHODS`: `CASH`, `CARD`, `MOBILE_BANKING`, `CREDIT`, `SPLIT`.
  - Supported `SALE_STATUSES`: `COMPLETED`, `PARTIALLY_REFUNDED`, `REFUNDED`, `VOIDED`.
  - When `paymentMethod === 'CREDIT'` or `dueAmount > 0`:
    - `customerId` is required.
    - If `customer.creditLimit > 0`, verify `customer.creditBalance + dueAmount <= customer.creditLimit`.
    - Increment `Customer.creditBalance` atomically inside the sale transaction.
  - Customer debt repayments go through `POST /api/customers/[id]/repay`, which decrements `Customer.creditBalance`, records a `SalePayment`, and (if paid in `CASH` during an open shift) logs a `DEBT_REPAYMENT` `CashDrawerMovement`.
  - When `Settings.loyaltyEnabled` is true and a customer is attached to a sale, calculate `pointsRedeemed` discount (`pointsRedeemed * loyaltyRedeemRate`) and `pointsEarned` (`Math.floor(netTotal / loyaltyEarnRate)`), updating `Customer.loyaltyPoints` atomically.
- **Partial & Full Refunds / Voids (`PUT /api/sales/[id]`):**
  - Supports `VOIDED`, `REFUNDED` (full), and `PARTIALLY_REFUNDED` (item-by-item quantities).
  - Supports `refundMethod: 'ORIGINAL' | 'CASH'` (allowing non-cash sales like KBZPay/WavePay/Card to be refunded in cash from the active drawer if chosen).
  - Must atomically restore `Product.stockQuantity`, create `RETURN` `StockMovement` records, Increment `SaleItem.refundedQuantity`, reverse proportional `Customer.totalSpent` / `creditBalance` / `loyaltyPoints`, and create `SaleAdjustment` + `CashDrawerMovement` records.
- **Net Profit Calculation (`/api/reports`):**
  - `Gross Profit = Revenue - COGS (Cost of Goods Sold)`
  - `Net Profit (အသားတင်အမြတ်) = Gross Profit - Total Expenses`

### Rule 5: Enterprise UI/UX & Design System Standards
- **Vector Icons Only (`lucide-react`):**
  - **NEVER** use OS cartoon emojis (`📊`, `🛒`, `🌾`, `💵`, `✏️`, `🗑️`, etc.) in any UI component or constant.
  - **ALWAYS** import icons from `src/components/ui/Icons.tsx` (`strokeWidth={1.75}`), using `<NavIcon />`, `<PaymentMethodIcon />`, `<StockMovementIcon />`, and `<ProductMonogram />` (2-letter SKU/Product monogram fallback when a product has no uploaded photo).
- **Color Palette & Surface System (`src/app/globals.css`):**
  - **Clean Slate Light Mode (`[data-theme='light']` — Default):** `#F8FAFC` app canvas, `#FFFFFF` cards, `#F1F5F9` controls, `#E2E8F0` `1px solid` borders, `#0F172A` text, `#D97706` (`Amber 600`) primary brand accent.
  - **Matte Zinc Dark Mode (`:root` / `[data-theme='dark']`):** `#09090B` canvas, `#121215` cards, `#18181B` controls, `#27272A` borders, `#FAFAFA` text, `#F59E0B` (`Amber 500`) primary brand accent.
  - Do **NOT** reintroduce neon glow blobs, heavy glassmorphism blur, gradient text, or fake hardcoded dashboard percentage badges (`+12.5%`).
- **Tabular Typography:**
  - All currency figures, quantities, KPI values, cart totals, and table number columns must preserve `font-variant-numeric: tabular-nums`.

### Rule 6: Thermal Printing & Barcode Sticker Engine (`src/lib/print.ts`)
- **NEVER** call raw `window.print()` directly for modal receipts, shift reports, or barcode labels on the main POS/Dashboard window (complex modal transforms, scroll containers, and Dark Mode CSS variables can cause blank print previews).
- **ALWAYS** use `printElementById(elementId, { title, paperSize })` from `src/lib/print.ts`:
  - Renders the target HTML inside a clean, isolated hidden `<iframe>` with self-contained `#000000` on `#ffffff` thermal CSS (`80mm`, `58mm`, or `A4`).
  - Waits for any embedded `<img>` (such as business logo) to finish loading before triggering `iframe.contentWindow.print()`.
- Keep `@media print` in `src/app/globals.css` free of high-specificity `body:has(...) * { visibility: hidden !important }` rules so keyboard `Ctrl+P` also works cleanly.

### Rule 7: Bilingual Support (`EN` / `MM`) & Translation Audit
- All UI text must support both English (`en`) and Myanmar (`mm`) via `useI18n()` from `src/lib/i18n.ts`.
- Use either dictionary keys `t('keyName')` (registered in both `translations.en` and `translations.mm` in `src/lib/i18n.ts`) or inline bilingual fallbacks `t('English text', 'မြန်မာစာသား')`.
- **NEVER** pass an empty second argument `t('English', '')` or leave missing keys in `src/lib/i18n.ts`.

### Rule 8: Single Responsibility Principle (SRP) & Component Size Limits
- **Component Modularity:** Avoid monolithic `*Client.tsx` files exceeding `400` lines. Separate page orchestration, filter bars, data tables, and form/action modals into focused sub-components (e.g., `ProductFormModal.tsx`, `BarcodeStickerModal.tsx`, `SaleRefundModal.tsx`, `ShiftThermalReport.tsx`).
- **Function Size:** Functions and handlers should do one thing well and stay under `60` lines where practical.

### Rule 9: DRY (Don't Repeat Yourself) — Shared Domain Utilities & Hooks
- **Never duplicate utility algorithms across components:**
  - Client-side `<canvas>` image compression belongs in `src/lib/image.ts`.
  - Code-128B barcode SVG generation belongs in `src/lib/barcode.ts`.
  - Expiry date status/days-remaining calculation (`getExpiryInfo`) belongs in `src/lib/utils.ts`.
  - Payment method / Sale status badge & label helpers belong in `src/lib/saleHelpers.ts`.
  - Authenticated mutating `fetch` calls with `x-csrf-token` header belong in a shared `apiFetch()` helper in `src/lib/apiClient.ts`.

### Rule 10: Thin API Route Controllers & Domain Service Layer (`src/services/*`)
- Next.js `route.ts` files (`src/app/api/**/route.ts`) should act strictly as **HTTP Controllers** (`< 100` lines):
  1. CSRF validation (`validateCsrf`)
  2. Authentication & RBAC (`requireAuth` / `requireRole`)
  3. Zod request parsing (`safeParse`)
  4. Calling a pure domain service (`src/services/saleService.ts`, `src/services/shiftService.ts`, `src/services/reportService.ts`)
  5. Returning standardized JSON response.
- All multi-step Prisma `$transaction` blocks and accounting formulas belong in `src/services/*`.

### Rule 11: Canonical DTOs & Strict Type Safety (`src/types/index.ts`)
- **Zero `any` Policy:** Never use `any` or unsafe type casts (`as unknown as ...`) when a typed DTO or Prisma payload type can be used.
- **Single Source of Truth for DTOs:** Shared serialized interfaces (`ProductDTO`, `SaleDTO`, `SaleItemDTO`, `CustomerDTO`, `ShiftDTO`, `ExpenseDTO`) must be defined once in `src/types/index.ts` and imported by both Server Components and Client Components instead of redeclaring local `interface Product` / `interface Sale` inside every `*Client.tsx` file.

### Rule 12: Standardized API Error Handling (`src/lib/apiError.ts`)
- Use a custom `AppError(message, statusCode, code)` class and a central `handleApiError(error, context)` wrapper so all API routes return consistent `{ error: string, code?: string, details?: unknown }` payloads with appropriate HTTP status codes (`400`, `401`, `403`, `404`, `409`, `422`, `500`) without duplicating `try/catch` boilerplate.

### Rule 13: Automated Testing for Financial, Timezone & Inventory Invariants
- Every pure calculation module (Myanmar `UTC+6:30` date boundaries, Cart subtotal/discount/tax math, Loyalty points earn/redeem math, Shift `expectedCash` math, and Code-128B barcode encoding) should have deterministic unit tests (`Vitest`) under `src/__tests__/`.

### Rule 14: Semantic CSS Utilities Over Inline Style Sprawl
- Avoid repetitive inline `style={{ display: 'flex', alignItems: 'center', gap: 8, ... }}` objects across JSX files. Use semantic utility classes in `src/app/globals.css` (Only use inline styles for truly dynamic runtime values such as chart widths or dynamic progress bars).

---

## 3. Codebase Structure & Key Files Map

| Path | Responsibility |
| :--- | :--- |
| `prisma/schema.prisma` | Database models: `User`, `Category`, `Product`, `ProductUnit`, `Customer`, `Sale`, `SaleItem`, `SalePayment`, `Shift`, `CashDrawerMovement`, `SaleAdjustment`, `StockMovement`, `Expense`, `Supplier`, `PurchaseOrder`, `PurchaseItem`, `SupplierPayment`, `StocktakeSession`, `StocktakeItem`, `Promotion`, `Quotation`, `QuotationItem`, `AuditLog`, `Settings`, `InvoiceCounter`, `RateLimitBucket`, `DataMigrationAudit` |
| `src/services/saleService.ts` | Domain service for Sales listing, single sale lookup, atomic Checkout (`createSale` with invoice counter retry, multi-unit conversion factor stock deduction, server-side Best Single Promotion evaluation, quotation conversion, custom price override + audit logging, split/credit/cash legs, creditLimit `> 0` check, loyalty points, drawer movements), and Partial/Full Refund & Void (`refundOrVoidSale` with clamped credit decrement) |
| `src/services/reportService.ts` | Domain service for Revenue, COGS, Gross Profit, Expenses, Net Profit, Myanmar daily/hourly sales buckets, top products, and category breakdown (`generateSalesAndProfitReport`) |
| `src/services/inventoryAnalyticsService.ts` & `agingService.ts` & `cashierAnalyticsService.ts` | Domain services for Inventory Valuation / Dead Stock / Sales-Velocity Reorder Suggestions, AR/AP Aging buckets (`0-30/31-60/61-90/90+d`), and Cashier Performance & Fraud Risk analytics |
| `src/services/stocktakeService.ts` & `promotionService.ts` & `quotationService.ts` | Domain services for Physical Stocktake sessions (`ST-YYYYMMDD-XXXX`), Promotions & Auto-Discounts (`promotionEngine.ts`), and Wholesale Proforma Quotations (`QT-YYYYMMDD-XXXX`) |
| `src/services/supplierService.ts` | Domain service for Supplier directory CRUD and Accounts Payable repayments (`repaySupplierDebt` with optional open-shift `PAID_OUT` cash drawer movement & audit logging) |
| `src/services/purchaseService.ts` | Domain service for Purchase Orders / Goods Receiving (`createPurchaseOrder` with Myanmar `PO-YYYYMMDD-XXXX` counter, automatic `StockMovement IN`, **Latest Purchase Cost** update on `Product.costPrice`, `Supplier.creditBalance` increment, and atomic PO cancellation) |
| `src/services/auditService.ts` | Central immutable security audit logger (`logAudit`) and filterable log query service (`listAuditLogs`) for `/audit-logs` |
| `src/lib/utils.ts` | Currency/quantity formatting (`formatCurrency`, `formatQuantity`, `isFractionalUnit`), expiry evaluation (`getExpiryInfo`), & Myanmar `UTC+6:30` date/time utilities |
| `src/lib/image.ts` | Shared client-side `<canvas>` image compression (`resizeImageToDataUrl`) for product photos and shop logos |
| `src/lib/barcode.ts` | Shared Code-128B barcode encoder (`encodeCode128BCodes`, `buildCode128Bars`) for SVG thermal sticker rendering |
| `src/lib/saleHelpers.ts` & `src/lib/csv.ts` | Shared Sale DTO interfaces, payment/status badge helpers, receipt data mapper (`buildReceiptDataFromSale`), UTF-8 BOM CSV exporter (`downloadSalesCsv`), and OWASP formula-safe CSV escaping (`escapeCsvCell`) |
| `src/lib/print.ts` | Dedicated hidden `<iframe>` print engine (`printElementById`) for 80mm/58mm receipts, Shift X/Z-Reports, and Barcode labels |
| `src/lib/dataMigrationSchema.ts` & `dataMigrationWorkbook.ts` & `dataMigration.ts` | Enterprise v2.1 24-sheet Excel Data Migration engine (bilingual `Instructions` cover sheet + sheet directory + enum quick reference, Amber required / Slate optional color-coded headers, Text `@` formatting for phones/barcodes, dynamic currency/qty number formats, status pill styling, backward-compatible legacy parser, and atomic topological DB upserts including Stocktakes, Promotions & Quotations) |
| `src/lib/promotionEngine.ts` & `saleCalculator.ts` & `customerDisplayChannel.ts` | Pure Best Single Discount promotion evaluator (`PERCENT_OFF`, `FIXED_OFF`, `BUY_X_GET_Y` mix-and-match, `MIN_SPEND_*`), shared integer MMK (`Math.round` 0-decimal) order pricing calculator (`saleCalculator.ts`), and `BroadcastChannel` + `localStorage` sync helper for `/pos/display` |
| `src/lib/i18n.ts` | Bilingual (`EN` / `MM`) dictionary and `useI18n()` hook |
| `src/lib/validations.ts` | Zod schemas for all API payloads |
| `src/lib/apiAuth.ts` & `pageAuth.ts` | Server/API authentication, RBAC role guards, CSRF validation, session version verification |
| `src/components/ui/Icons.tsx` | Centralized `lucide-react` vector icons & `<NavIcon />`, `<PaymentMethodIcon />`, `<StockMovementIcon />`, `<ProductMonogram />` |
| `src/components/ui/ImageLightboxModal.tsx` & `CameraBarcodeModal.tsx` & `GlobalLoadingBar.tsx` | Reusable click-to-enlarge image & Mobile Banking QR Lightbox modal, cross-browser `@zxing/browser` Camera Barcode Scanner modal (`camera=(self)` in `next.config.ts`), and 3-layer global navigation + API progress bar / bottom-right mutation pill (`src/lib/loadingTracker.ts`, `src/app/(dashboard)/loading.tsx`, `src/app/(dashboard)/pos/loading.tsx`) |
| `src/store/cartStore.ts` | POS cart state, `%`/`K` discounts, item discounts, fractional quantities, Hold/Resume multi-bill queue (`heldCarts`) |
| `src/store/offlineQueueStore.ts` | Offline POS sale queue (`localStorage`) & automatic background sync when internet reconnects |
| `src/components/pos/*` | `POSClient.tsx`, `ProductGrid.tsx`, `Cart.tsx`, `PaymentModal.tsx`, `Receipt.tsx`, `KeyboardShortcutsModal.tsx`, `CustomerDisplayClient.tsx` (`/pos/display` dual-screen monitor, Hotkeys `F2`/`F4`/`F8`/`F9`/`?`, Camera Barcode Scanner, Best Single Promotion engine, Price Override + Cost Floor Warning, Multi-Unit dropdown, Mobile Banking QR Lightbox) |
| `src/components/stocktake/StocktakeClient.tsx` | Physical inventory count workspace (`/stocktake`) with barcode/camera scan-to-count, live variance valuation, atomic batch adjustment & A4 Variance Report print |
| `src/components/promotions/PromotionsClient.tsx` | Promotions & Auto-Discount Rules manager (`/promotions`) supporting Percentage/Fixed Off, Buy X Get Y, Min Spend & Promo Codes |
| `src/components/quotations/QuotationsClient.tsx` | Wholesale Quotations / Proforma manager (`/quotations`) with A4 print & 1-Click Load to POS Cart |
| `src/components/shifts/ShiftClient.tsx` | Cashier shift open/close, Paid-In/Paid-Out drawer movements, 80mm/58mm Shift X-Report & Z-Report printing |
| `src/components/sales/*` | `SalesClient.tsx`, `SaleDetailClient.tsx`, `SaleQuickViewModal.tsx`, `SaleRefundModal.tsx`, `SaleA4InvoiceModal.tsx` (A4 Formal Invoice & Delivery Order print) |
| `src/components/products/*` | `ProductsClient.tsx`, `ProductFormModal.tsx` (with Alternate Multi-Unit Packaging editor), `BarcodeStickerModal.tsx` |
| `src/components/inventory/InventoryClient.tsx` | Stock In/Out/Adjustment/Return movements, low-stock & expiry alerts |
| `src/components/suppliers/*` | `SuppliersClient.tsx` & `SupplierModals.tsx` (Supplier CRUD, PO/Payment History, Accounts Payable repayment) |
| `src/components/purchases/*` | `PurchasesClient.tsx` & `PurchaseFormModal.tsx` (Purchase Order Goods Receiving, automatic stock-in & Latest Purchase Cost update, PO cancellation) |
| `src/components/customers/*` | `CustomersClient.tsx`, `CustomerModals.tsx`, `DebtRepaymentReceiptModal.tsx`, `CustomerCreditStatementModal.tsx` (Customer CRUD, Credit KPIs, Reconcile Credit sync, A4/80mm Credit Statement Print + 1-Click Viber/SMS Reminder Copy, Loyalty points, Debt repayment receipt) |
| `src/components/reports/*` | `ReportsClient.tsx`, `ReportExportModal.tsx`, `InventoryAnalyticsTab.tsx` (Valuation/Dead Stock/1-Click PO Reorder), `AgingReportTab.tsx` (AR/AP Aging), `CashierPerformanceTab.tsx` (Staff Sales & Risk Audit) |
| `src/components/audit/AuditLogsClient.tsx` | Admin-only Security Audit Log Viewer (`/audit-logs`) with date/user/action filtering, JSON metadata inspection, and CSV export |
| `src/components/settings/*` | `SettingsClient.tsx` (including Mobile Banking QR Code upload), `UserManagementSection.tsx`, `DataMigrationSection.tsx` |
| `src/__tests__/domain.test.ts` | Automated unit tests for Myanmar `UTC+6:30` timezone boundaries, currency/fractional quantities, shift cash drawer math, Code-128B barcode encoding, and POS cart discounts/tax/hold queue |

---

## 4. Mandatory Pre-Commit Verification Checklist

Before finishing any task or committing code, run and pass all of the following commands:

```bash
# 1. Verify all EN/MM translation keys and fallback strings
npm run i18n:audit

# 2. Verify zero TypeScript compilation errors
npm run lint

# 3. Run automated domain unit tests
npm test

# 4. Verify production Next.js build (when routes, types, or schema change)
npx next build
```

---

## 5. Living Changelog (ပြင်ဆင်မှု မှတ်တမ်း)

> *Update this section every time a modification or new feature is completed.*

- **2026-11-08 — Real-World Production Upgrade (Phases 1–6):**
  - Standardized all dates/invoices/reports to `Asia/Yangon (UTC+6:30)`.
  - Upgraded Prisma schema (`20261108000000_real_world_pos_upgrade`) for `Decimal(18,3)` fractional stock, `batchNumber`, `expiryDate`, `Customer.creditBalance` / `creditLimit`, `SalePayment`, `SaleItem.refundedQuantity`, and `Settings.loyalty*`.
  - Added Cash Drawer Paid-In/Paid-Out movements, Partial/Full & Cash/Original refunds, Net Profit (`Gross Profit - Expenses`), Hold/Resume bills, Split & Credit payments, Loyalty points, Debt repayment, Local image compression, Code-128B Barcode label printing, and Offline POS sale queue.
- **2026-11-08 — Enterprise Retail POS UI/UX Redesign (Steps 1–6):**
  - Installed `lucide-react` and created `src/components/ui/Icons.tsx`, replacing all OS emojis across the app.
  - Redesigned `src/app/globals.css` with Clean Slate Light Mode (default) and Matte Zinc Dark Mode, Warm Amber/Gold accent, `1px solid` borders, and `tabular-nums` typography.
- **2026-11-10 — Dedicated Print Engine & Operational Quick Wins:**
  - Created `src/lib/print.ts` (`printElementById` hidden `<iframe>` print engine) and fixed `@media print` specificity in `src/app/globals.css` so 80mm/58mm receipts and barcode labels print reliably in both Dark Mode and Light Mode.
  - Added 80mm/58mm **Shift X-Report & Z-Report** thermal printing in `src/components/shifts/ShiftClient.tsx`.
  - Added **1-Click Receipt Reprint** and real **UTF-8 CSV Export** in `src/components/sales/SalesClient.tsx` and `SaleDetailClient.tsx`.
  - Added **Stock & 30-Day Expiry Alerts Widget** on Dashboard (`src/app/(dashboard)/page.tsx`, `src/components/dashboard/DashboardClient.tsx`).
  - Added PWA installability (`public/manifest.json`, `src/app/layout.tsx`, `src/proxy.ts`) and cleaned up `.gitignore`.
  - Created `AGENTS.md` as the self-updating project rules and architecture reference (Rules 1–14, including Enterprise Clean Code, SRP, DRY, Service Layer, Canonical DTOs, Error Handling, Unit Testing, and Semantic CSS rules).
- **2026-11-11 — Enterprise Clean Code Architecture Refactoring:**
  - **DRY Shared Domain Utilities (Rule 9):** Extracted `src/lib/image.ts` (`resizeImageToDataUrl`), `src/lib/barcode.ts` (`encodeCode128BCodes`, `buildCode128Bars`), `src/lib/saleHelpers.ts` (`getPaymentMethodLabel`, `getSaleStatusBadgeClass`, `getSaleStatusLabel`, `buildReceiptDataFromSale`, `downloadSalesCsv`), and `getExpiryInfo` in `src/lib/utils.ts`.
  - **Thin API Route Controllers & Domain Service Layer (Rule 10):** Extracted `src/services/saleService.ts` and `src/services/reportService.ts`, reducing `src/app/api/sales/route.ts` (`617 -> 50 lines`), `src/app/api/sales/[id]/route.ts` (`362 -> 43 lines`), and `src/app/api/reports/route.ts` (`319 -> 17 lines`) into clean HTTP controllers.
  - **SRP Component Modularization (Rule 8):** Decomposed monolithic `1,000+` line client components into focused sub-components: `ProductFormModal.tsx` & `BarcodeStickerModal.tsx` (`ProductsClient.tsx`: `1,393 -> 438 lines`), `UserManagementSection.tsx` & `DataMigrationSection.tsx` (`SettingsClient.tsx`: `1,392 -> 502 lines`), `SaleRefundModal.tsx` & `SaleQuickViewModal.tsx` (`SalesClient.tsx`: `1,192 -> 383 lines`, `SaleDetailClient.tsx`: `801 -> 399 lines`), and `CustomerModals.tsx` (`CustomersClient.tsx`: `1,134 -> 434 lines`).
  - **Automated Domain Unit Tests (Rule 13):** Added `src/__tests__/domain.test.ts` (`npm test`) covering Myanmar `UTC+6:30` timezone boundaries, currency/fractional quantity formatting, product expiry evaluation, Shift `expectedCash` accounting, Code-128B barcode encoding, and POS cart discounts/tax/hold queue.
- **2026-11-23 — Enterprise Tiers 1–3 Feature Suite (`20261123000000_enterprise_tiers_1_to_3`):**
  - **Unified Schema Migration:** Added `Settings.mobileBankingQrUrl` & `mobileBankingName`, `ProductUnit`, `SaleItem.unitName` & `unitFactor`, `Supplier`, `PurchaseOrder`, `PurchaseItem`, `SupplierPayment`, and `AuditLog`.
  - **Tier 1 (Immediate Retail Operations):**
    - POS Keyboard Shortcuts (`F2` Search/Barcode Enter scan, `F4` Hold/Resume, `F8` Customer Search, `F9`/`Ctrl+Enter` Pay, `?` `KeyboardShortcutsModal.tsx`, `Esc`).
    - Customer Debt Repayment `80mm`/`58mm` Thermal Receipt (`DebtRepaymentReceiptModal.tsx`) + fixed `POST /api/customers/[id]/repay` top-level `newCreditBalance`/`previousBalance` payload.
    - Mobile Banking QR Code upload in `/settings` and automatic QR display on `MOBILE_BANKING` & `SPLIT` checkout in `PaymentModal.tsx`.
    - Reports UTF-8 CSV export & `A4`/`80mm` Thermal Profit & Loss Summary Print (`ReportExportModal.tsx`).
    - POS Cart inline Custom Unit Price Override with reset toggle, Manager/Admin Cost Floor Warning badge, and backend `PRICE_OVERRIDE` audit logging.
  - **Tier 2 (Procurement & Multi-Unit Wholesale/Retail):**
    - Supplier Directory & Accounts Payable Repayment (`/suppliers`, `supplierService.ts`, `SuppliersClient.tsx`, `SupplierModals.tsx`).
    - Purchase Orders / Goods Received (`/purchases`, `purchaseService.ts`, `PurchasesClient.tsx`, `PurchaseFormModal.tsx`) with atomic Myanmar `PO-YYYYMMDD-XXXX` numbering, automatic `StockMovement IN`, **Latest Purchase Cost** update on `Product.costPrice`, payable tracking, and stock-safe PO cancellation.
    - Multi-Unit Wholesale/Retail Packaging (`ProductUnit`) across `/products`, Product APIs, POS barcode scanning, Cart unit dropdown, and `saleService.ts` base-stock deduction & refund restoration.
  - **Tier 3 (Governance & Security Audit Trail):**
    - Central `auditService.ts` (`logAudit`) hooked across sales voids/refunds, price overrides, product price changes, stock adjustments, purchase orders, supplier/customer debt repayments, shift closing, user updates, and settings updates.
    - Admin-only `/audit-logs` viewer (`AuditLogsClient.tsx`, `/api/audit-logs`) with bilingual (`EN`/`MM`) action, entity, and role labels, date/user/action filters, metadata JSON inspector, and CSV export.
  - **Full-App Bilingual (`EN`/`MM`) Polish Audit:** Localized all remaining raw enum badges and hardcoded English labels across Shifts (`OPENING`/`CASH_SALE`/`PAID_IN`/`PAID_OUT`/`REFUND`/`VOID`/`CLOSING`), Products (`ProductFormModal` fields, unit options & validation messages), Customers (recent sale status badges), Sales Refund modal (original payment method label), Dashboard role badge, Expenses (removed stray plural `'s'` in Myanmar mode + validation errors), Settings (user validation + migration errors), Reports (pie tooltip + P&L payment method labels), POS (offline/queue badges + split balance), Purchases & Suppliers payment methods.
- **2026-11-23 — Cross-Feature Sync Audit & Enterprise Excel Data Migration v2.0 Redesign:**
  - **Dashboard & Reports Accuracy Sync:** Aligned Dashboard (`src/app/(dashboard)/page.tsx`) with `/reports` by including `PARTIALLY_REFUNDED` sales, replacing raw server-UTC date boundaries with Myanmar `UTC+6:30` `parseMyanmarDateBoundary`, and multiplying `SaleItem` quantities by `unitFactor` (net of `refundedQuantity`) across both Dashboard Top 5 Products and `src/services/reportService.ts`.
  - **Multi-Unit Consistency Across Sales, Refunds, Products, Barcodes & Offline POS:**
    - Updated `SaleDetailClient.tsx`, `SaleQuickViewModal.tsx`, and `SaleRefundModal.tsx` to display and refund using sold packaging units (`item.unitName || item.product?.unit`, with base-unit equivalence on `SaleDetailClient`) and clean Myanmar confirmation phrasing.
    - Updated `offlineQueueStore.ts`, `PaymentModal.tsx`, and `POSClient.tsx` so offline receipts preserve `unitName`/`unitFactor` and multi-unit cart lines for the same product sum their base stock deductions accurately.
    - Added Multi-Unit `<Layers />` badges + alternate barcode search in `ProductsClient.tsx`, Multi-Unit selector (unit barcode + unit selling price) in `BarcodeStickerModal.tsx`, and replaced duplicated expiry math in `InventoryClient.tsx` with shared `getExpiryInfo()`.
  - **Enterprise Excel Data Migration v2.0 Redesign (`dataMigrationSchema.ts`, `dataMigrationWorkbook.ts`, `dataMigration.ts`, `/api/data-migration`):**
    - Expanded full schema coverage from 13 to all **19 operational tables** (`+ProductUnits`, `Suppliers`, `PurchaseOrders`, `PurchaseItems`, `SupplierPayments`, `SalePayments`) and added all missing columns (`Products.batchNumber/expiryDate`, `Customers.creditBalance/creditLimit`, `Sales.dueAmount/pointsEarned/pointsRedeemed`, `SaleItems.refundedQuantity/unitName/unitFactor`, `Settings.loyalty*/mobileBanking*`).
    - Redesigned Excel visual layout: branded Slate/Amber bilingual `Instructions` cover sheet with workbook metadata, color legend, 19-sheet directory with row counts, and Allowed Enum Reference table; frozen color-coded headers (Amber = Required, Slate = Optional), zebra row shading, thin slate borders, status color tints, `@` Text formatting on phones/barcodes/SKUs to preserve leading zeros and prevent EAN scientific notation, and dynamic integer/decimal formats for Kyat & fractional quantities.
    - Fixed 6 import bugs (`Shifts.status` now saved, `CashDrawerMovements` allows negative `PAID_OUT` & zero `OPENING`/`CLOSING`, `InvoiceCounters` allows `PO-YYYYMMDD`, `Sales` handles `PARTIALLY_REFUNDED`, `Settings` allows 500KB base64 `logo`/`mobileBankingQrUrl`, `StockMovements` handles PO-cancel `ADJUSTMENT`), preserved backward compatibility for legacy v1 exports, and hooked `DATA_MIGRATION_IMPORT` into `AuditLog` + `/audit-logs`.
    - Added Excel v2.0 round-trip & legacy backward-compatibility automated tests in `src/__tests__/domain.test.ts`.
  - **Click-to-Enlarge QR & Image Lightbox (`ImageLightboxModal.tsx`):**
    - Added reusable click-to-enlarge lightbox modal across POS Checkout (`PaymentModal.tsx` — both `MOBILE_BANKING` and `SPLIT` QR thumbnails with enlarged scan view + exact payable amount), Settings (`SettingsClient.tsx` — Mobile Banking QR & Shop Logo preview + raised QR upload maxSize to `640px`), and Products table (`ProductsClient.tsx` — product photo preview).
- **2026-11-24 — Phase 0 (Customers Credit Balance Fix) + Tier 1 & Tier 2 Operations Suite (`20261124000000_tier1_tier2_operations_suite`):**
  - **Phase 0 — Customers Credit Balance Bugfix & Reconciliation:**
    - Fixed `creditLimit = 0` blocking credit sales (`saleService.ts` now enforces `creditLimit > 0`; `CustomersClient.tsx` and customer APIs normalize `0` to `null`/Unlimited).
    - Fixed `PaymentModal.tsx` retaining cash `paidAmountStr` when switching to `CREDIT` tab and prevented saving 0-due `CREDIT` sales.
    - Fixed `saleService.ts` clamping credit balance decrement on refunds (`>= 0`), added FIFO `Sale.dueAmount` settlement inside `/api/customers/[id]/repay`, enabled case-insensitive PostgreSQL customer search, marked `/customers` `force-dynamic`, added Credit KPI cards + `Credit Due Only` filter + `POST /api/customers/reconcile-credit` (`Sync Credit` button), and expanded `CustomerDetailModal` with payment method, due amount, and repayment history.
  - **Tier 1 (Daily Store Operations & Speed):**
    - **Stocktake (`/stocktake`):** Physical inventory count sessions (`ST-YYYYMMDD-XXXX`), barcode/camera scan-to-count, live variance valuation, atomic batch stock adjustments (`StockMovement ADJUSTMENT` + `AuditLog`), and A4 Variance Report print.
    - **Promotions & Auto-Discounts (`/promotions`):** Pure `promotionEngine.ts` implementing **Best Single Discount** (non-stacking) for `PERCENT_OFF`, `FIXED_OFF`, `BUY_X_GET_Y`, `MIN_SPEND_PERCENT`, `MIN_SPEND_FIXED`, and Promo Codes across POS `Cart.tsx`, `PaymentModal.tsx`, and server-side `saleService.ts`.
    - **Dual-Screen Customer Display (`/pos/display`):** Real-time `BroadcastChannel` + `localStorage` customer monitor showing idle store branding, live scanned cart & promo savings, automatic enlarged Mobile Banking QR + exact payable amount during checkout, and change/thank-you screen.
    - **Camera Barcode Scanner (`CameraBarcodeModal.tsx`):** Updated `next.config.ts` `Permissions-Policy` to `camera=(self)` and integrated `@zxing/browser` camera scanner across POS, Stocktake, and Product Form.
  - **Tier 2 (Accounting, Credit Control & Wholesale Power):**
    - **Inventory Valuation, Dead Stock & Auto-Reorder -> 1-Click PO:** `inventoryAnalyticsService.ts` + `/reports` tab with cost/retail valuation, dead stock capital report, sales-velocity reorder suggestions, and 1-click PO prefill in `PurchasesClient.tsx` / `PurchaseFormModal.tsx`.
    - **AR/AP Aging & Customer Credit Statement:** `agingService.ts` (`0-30/31-60/61-90/90+d` Myanmar buckets), `/reports` AR/AP Aging tab (CSV + A4 Print), and `CustomerCreditStatementModal.tsx` (A4/80mm printable statement + 1-click Copy Viber/SMS reminder).
    - **Quotations / Proforma (`/quotations`) & Sales A4 Invoice:** `quotationService.ts` (`QT-YYYYMMDD-XXXX`), A4 Proforma print, 1-click Load to POS Cart (auto-marking `CONVERTED` on checkout), and `SaleA4InvoiceModal.tsx` (Formal A4 Invoice & no-price Delivery Order) on `/sales/[id]`.
    - **Cashier Performance & Fraud Risk Analytics:** `cashierAnalyticsService.ts` + `/reports` tab tracking per-staff net sales, basket size, discounts, price overrides, void/refunds, and shift cash variance (CSV + A4 print).
    - **Excel Data Migration v2.1:** Expanded to 24 operational sheets (`+Promotions`, `Quotations`, `QuotationItems`, `StocktakeSessions`, `StocktakeItems`, plus `Sales` promo columns & `ST-`/`QT-` invoice counters) and added unit tests in `src/__tests__/domain.test.ts`.
- **2026-11-24 — Full-Codebase Security, Accounting & Business Logic Hardening (Option A — 13 Critical + 19 High + ADMIN-Only Deletion):**
  - **Runtime Loops, Security & RBAC:**
    - Memoized `t()` with `useCallback` in `src/lib/i18n.ts` and decoupled `t` from fetch/scanner hooks across `InventoryAnalyticsTab`, `AgingReportTab`, `CashierPerformanceTab`, `POSClient`, and `CameraBarcodeModal` (fixing infinite DB fetch & camera open/close loops, hardware stream leaks, and rear-camera switch index order).
    - Fixed Stored XSS in `src/lib/print.ts` via `escapePrintHtml()` on iframe `<title>`.
    - Fixed `ERR_TOO_MANY_REDIRECTS` loop on revoked/stale sessions (`pageAuth.ts` → `/login?reason=session_expired`, allowed in `auth.config.ts`, auto `signOut({ redirect: false })` on `/login`).
    - Added Server Component `requirePageRole('ADMIN')` guard on `/users` (`UsersClient.tsx`), blocked Admin self-demotion/self-deactivation & last-active-admin lockout (`api/users/[id]`, `dataMigration.ts`), guarded `/api/auth/signout-cleanup` with `sessionVersion`, enforced CASHIER ownership & blocked manual `CONVERTED` tampering on `/api/quotations/[id]`, and restricted Category/Product/Customer `DELETE` endpoints & UI buttons to **`ADMIN` only**.
  - **POS Rounding (`Math.round` 0-Decimal MMK Policy), Cart, Offline Queue, Promotions & Quotations:**
    - Added shared integer MMK pricing calculator `src/lib/saleCalculator.ts` (`roundMmk`, `calculateLineAmounts`, `calculateOrderTotals`) across POS, Quotations, Promotions, and `saleService.ts` so client previews and server totals match to the exact Kyat.
    - Upgraded `offlineQueueStore.ts` to retain recoverable `401`/`403`/`409`/`429`/`5xx` sales, quarantine `400`/`422` failures in persistent `failedSales` review UI with Retry/Discard, lock `unitPrice` on queued offline items, and surface full sync feedback.
    - Upgraded `cartStore.ts` to key lines by `lineKey` (`productId:productUnitId`) so loose + carton units coexist with combined base-unit stock limits, persisted `activeQuotationId`/`promoCode`/`activeCustomer` in `HeldBill` & `partialize`, refreshed live promotions via `/api/promotions/active` in `POSClient`, added atomic `Promotion.usageLimit` claims + void/refund release, atomic `Quotation` conversion (`DRAFT`/`SENT`/`ACCEPTED` + non-expired), and mix-and-match `BUY_X_GET_Y`.
  - **Sales Checkout, Split Legs, Refunds, Loyalty & Cash Drawer:**
    - Fixed `saleService.ts`: Customer & Sale `SELECT ... FOR UPDATE` row locks, sequential `CASH` change allocation across multiple split `CASH` legs, proportional/full loyalty points reversal on refund/void, exact cash drawer outflow on `SPLIT` & `CREDIT` upfront-cash refunds, duplicate `saleItemId` aggregation + integer-unit guard + empty `items` rejection on `PARTIALLY_REFUNDED`, `paymentStatus = 'PAID'` when due hits 0, and `VOIDED`/`REFUNDED`/`PARTIALLY REFUNDED` banners + refunded quantities on `Receipt.tsx` and `SaleA4InvoiceModal.tsx`.
  - **Shifts, Customers AR, Suppliers AP, Purchases, Expenses, Inventory, Stocktake & Reports:**
    - Fixed Shift Z-Report auto-open (`close/route.ts` returns `summary` + `movements` + atomic `OPEN` claim, unwrapped in `ShiftClient.tsx`) and independent `findFirst` for `current` open shift in `GET /api/shifts`.
    - Rebuilt `POST /api/customers/reconcile-credit` using chronological event-stream replay (`SALE` + `DEBT_REPAYMENT` + `SALE_ADJUSTMENT`) so refunded repaid credit sales never erase unrelated debt; added atomic `creditBalance >= amount` guards and own-shift cash drawer scoping on customer & supplier repayments; added FIFO `PurchaseOrder.dueAmount` settlement in `repaySupplierDebt`; loaded all unpaid credit sales on `/customers` Credit Statements.
    - Fixed `purchaseService.ts` (`paidAmount: 0` respected, atomic PO cancel claim, `costPrice` reversion to prior received PO, modal reset), blocked deactivating suppliers with `creditBalance > 0`, serialized `POST /api/expenses` with `serializePrismaData` (fixing string concatenation `K NaN` / millions bug), and fixed Myanmar timezone date bugs across `PromotionsClient`, `ExpensesClient`, `ProductsClient`, and `expenses` APIs.
    - Fixed `month - 1` off-by-one bugs in `inventoryAnalyticsService.ts` & `agingService.ts`, fixed AP/AR Aging `balanceCap === 0` paid-off bug (LIFO remaining balance allocation), excluded brand-new products from Dead Stock, updated `reportService.ts` P&L to exclude sales tax from profit, allocate order discounts across Top Products/Categories, and aggregate `paymentBreakdown` from `SalePayment` legs.
    - Fixed `stocktakeService.ts` atomic claim + delta-based stock adjustment (preserving interim POS sales/POs) + >500 item chunking in `StocktakeClient.tsx`; preserved `ProductUnit` IDs via diff/upsert in `PUT /api/products/[id]` + cross-table barcode uniqueness + centralized Prisma `P2002`/`P2025` handling in `handleApiError`; fixed `POST /api/inventory` `ApiError` codes & integer check; disabled Stock edit in `ProductFormModal.tsx`.
  - **Data Migration v2.1 Backup/Restore Integrity:**
    - Added DB fallback `resolvePromotion` in `importSales`, allowed multi-step refunded sales in `assertMoneyBalance`, negative `Shift.expectedCash`, `0 K` `SaleAdjustment.amount`, >32K base64 `MEDIA_OMITTED_MARKER` preserving DB images on re-import, conditional `sessionVersion` increments, and last-active-admin protection in `importUsers`.
- **2026-11-24 — Medium & Low Code/Business Logic Hardening Pass (All 10 Medium + 7 Low Domains):**
  - **Security, Rate Limit, CSV & Uploads:** Added composite IP + IP:email rate limiting in `src/lib/auth.ts` (`getClientIp`), OWASP spreadsheet formula neutralization (`src/lib/csv.ts`) across all 5 CSV exports, strict raster/HTTP(S) `safeImageUrlSchema` in `src/lib/validations.ts` (blocking `image/svg+xml`/`javascript:`), `.trim()`-before-`.min(1)` string schemas, automatic WebP/JPEG fallback compression under 450K chars in `src/lib/image.ts` + QR upload, NextAuth v5 `AUTH_URL` support in `validateCsrf`, production `Strict-Transport-Security` header in `next.config.ts`, `maxDuration = 60` + `DATA_MIGRATION_EXPORT` / `USER_CREATED` / `EXPENSE_*` audit logs, and real pagination in `AuditLogsClient.tsx`.
  - **POS, Promotions, Refunds & Quotations:** Evaluated `MIN_SPEND_*` against post-cart-discount subtotal consistently across client & server (`promotionEngine.ts`, `Cart.tsx`, `PaymentModal.tsx`, `POSClient.tsx`, `saleService.ts`), surfaced specific bilingual coupon hints (`MIN_SPEND_NOT_MET`, `NO_ELIGIBLE_ITEMS`, `OUTPERFORMED`), enforced integer refund validation in `SaleRefundModal.tsx`, cleared stale `paymentReference` on `CASH`/`CREDIT` switches & non-card split legs, and added conditional Item Discount column on A4 Quotation prints.
  - **Reports, Expiry, Cashier Analytics & Stocktake UX:** Fixed `getExpiryInfo` (`src/lib/utils.ts`) to use Myanmar calendar day diffs (eliminating `-0` / `0d` expired bugs between 00:00–06:29 MMT) and wired it into `DashboardClient.tsx`; surfaced non-2xx errors without desyncing `activeRange` and preserved overnight sales (`23:00–05:59`) in `ReportsClient.tsx`; added date validation, `approverUserId` approved-void metrics, and `totalAbsCashVariance` in `cashierAnalyticsService.ts` + `CashierPerformanceTab.tsx`; upgraded `StocktakeClient.tsx` with `ProductUnit.barcode` scanning (`+conversionFactor`), strict count validation, full-session plain-text `#stocktake-print-area`, Complete/Cancel confirmation modals, and `router.refresh()`.
  - **Sales, Inventory, Products, Expenses, Shifts, Suppliers & Polish:** Wired automatic server-side filtering (`limit=500`) in `SalesClient.tsx` and `InventoryClient.tsx` + accurate `ADJUSTMENT` delta display; added `'bottle'` unit, `sellingPrice > 0` validation on `ProductUnit`, case-insensitive PostgreSQL search (`mode: 'insensitive'`), and inactive-category edit safety; replaced truncated `take: 50` `purchaseCount` with uncapped `groupBy` in `/api/customers`; required non-cash reference label in `CustomerModals.tsx`; wired optional `CashDrawerMovement` (`PAID_OUT` via `expenseId`) + `AuditLog` + removed ignored `userId` selector in Expenses; standardized positive `PAID_OUT` sign in `supplierService.ts`, excluded `OPENING`/`CLOSING` from `summarizeShiftCash.movementCount`, and added Manager Override Close modal in `ShiftClient.tsx`; added inactive supplier filter + Restore in `SuppliersClient.tsx`; eliminated `CASHIER` `/api/inventory/low-stock-count` `403` polling in `Sidebar.tsx`, hid manager-only `/inventory` & `/sales` links from `CASHIER` on Dashboard, fixed reactive theme buttons & Yangon timestamps (`SettingsClient.tsx`, `Header.tsx`), removed remaining OS emojis & dead login state (`login/page.tsx`, `Header.tsx`), replaced `serializePrismaData(): any` with generic `SerializedPrisma<T>`, and added 5 new regression tests in `src/__tests__/domain.test.ts`.
- **2026-11-24 — 3-Layer Enterprise Hybrid Loading UX (Navigation + Global API + Route Skeletons):**
  - Added pure request/link classification helpers in `src/lib/loadingTracker.ts` (silencing background polls `/api/auth/validate-session`, `/api/inventory/low-stock-count`, `/api/promotions/active`, and initial `GET /api/settings`, while tracking foreground reads and mutations).
  - Created `src/components/ui/GlobalLoadingBar.tsx` and mounted it inside `<Suspense>` in `src/app/layout.tsx`: instant (`0ms`) Top Amber Progress Bar on internal route transitions, `150ms`-debounced Top Bar on foreground `/api/*` requests, and `550ms`-debounced non-blocking bottom-right floating status pill (`Processing...` / `လုပ်ဆောင်နေသည်...`) on slow `POST`/`PUT`/`PATCH`/`DELETE` mutations (hidden on `/pos/display` and print media).
  - Added Next.js App Router shimmer skeletons `src/app/(dashboard)/loading.tsx` (KPI + Toolbar + Table skeleton) and `src/app/(dashboard)/pos/loading.tsx` (POS Split Product Grid + Cart skeleton) styled in `src/app/globals.css`, plus `Loader2` icon export in `src/components/ui/Icons.tsx` and unit tests in `src/__tests__/domain.test.ts`.
