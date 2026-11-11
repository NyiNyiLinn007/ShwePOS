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
| `prisma/schema.prisma` | Database models: `User`, `Category`, `Product`, `Customer`, `Sale`, `SaleItem`, `SalePayment`, `Shift`, `CashDrawerMovement`, `SaleAdjustment`, `StockMovement`, `Expense`, `Settings`, `InvoiceCounter`, `RateLimitBucket`, `DataMigrationAudit` |
| `src/lib/utils.ts` | Currency/quantity formatting (`formatCurrency`, `formatQuantity`, `isFractionalUnit`) & Myanmar `UTC+6:30` date/time utilities |
| `src/lib/print.ts` | Dedicated hidden `<iframe>` print engine (`printElementById`) for 80mm/58mm receipts, Shift X/Z-Reports, and Barcode labels |
| `src/lib/i18n.ts` | Bilingual (`EN` / `MM`) dictionary and `useI18n()` hook |
| `src/lib/validations.ts` | Zod schemas for all API payloads |
| `src/lib/apiAuth.ts` & `pageAuth.ts` | Server/API authentication, RBAC role guards, CSRF validation, session version verification |
| `src/components/ui/Icons.tsx` | Centralized `lucide-react` vector icons & `<NavIcon />`, `<PaymentMethodIcon />`, `<StockMovementIcon />`, `<ProductMonogram />` |
| `src/store/cartStore.ts` | POS cart state, `%`/`K` discounts, item discounts, fractional quantities, Hold/Resume multi-bill queue (`heldCarts`) |
| `src/store/offlineQueueStore.ts` | Offline POS sale queue (`localStorage`) & automatic background sync when internet reconnects |
| `src/components/pos/*` | `POSClient.tsx`, `ProductGrid.tsx`, `Cart.tsx`, `PaymentModal.tsx`, `Receipt.tsx` |
| `src/components/shifts/ShiftClient.tsx` | Cashier shift open/close, Paid-In/Paid-Out drawer movements, 80mm/58mm Shift X-Report & Z-Report printing |
| `src/components/sales/*` | `SalesClient.tsx` (filters, CSV export, 1-click reprint, void/refund modals) & `SaleDetailClient.tsx` |
| `src/components/products/ProductsClient.tsx` | Product CRUD, fractional units, batch/expiry badges, client-side `<canvas>` image compression, Code-128B Barcode sticker printing |
| `src/components/inventory/InventoryClient.tsx` | Stock In/Out/Adjustment/Return movements, low-stock & expiry alerts |
| `src/components/customers/CustomersClient.tsx` | Customer CRUD, Loyalty points, Credit balance/limit, Debt repayment (`POST /api/customers/[id]/repay`) |
| `src/components/reports/ReportsClient.tsx` | Revenue, Gross Profit, Expenses, Net Profit, payment breakdown, top products, hourly distribution |
| `src/components/settings/SettingsClient.tsx` | Business info, compressed logo upload, tax/currency, Loyalty program settings, Excel Data Migration |

---

## 4. Mandatory Pre-Commit Verification Checklist

Before finishing any task or committing code, run and pass all of the following commands:

```bash
# 1. Verify all EN/MM translation keys and fallback strings
npm run i18n:audit

# 2. Verify zero TypeScript compilation errors
npm run lint

# 3. Verify production Next.js build (when routes, types, or schema change)
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
