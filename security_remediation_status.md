# Security remediation status

Reviewed and remediated on 2026-07-29.

## Completed

- Updated Next.js/NextAuth and removed the vulnerable `xlsx` dependency. The application now uses `read-excel-file` and `write-excel-file`; both production and full `npm audit` are clean.
- Added database-backed atomic rate limiting and removed the duplicate pre-login credential-check endpoint.
- Made the database authoritative for active state, role, and session version. Account changes invalidate existing sessions.
- Tightened CSRF origin checks, added production security headers/CSP, and protected the POS server page explicitly.
- Restricted customer PII/history to manager/admin roles and added bounded pagination.
- Enforced an open shift for cash sales and cash refunds/voids. Non-cash refund/void is blocked until provider reversal is confirmed.
- Changed monetary database fields to `Decimal(18,2)` with a migration and normalized Decimal values at API/page boundaries.
- Added strict report date validation and rejects report ranges containing more than 10,000 completed sales.
- Hardened Excel migration with `.xlsx` signature/ZIP-bomb checks, row/column limits, enum/domain validation, money invariants, import rate limiting, audit records, and redacted user/payment secrets.
- Removed fixed seed credentials. Demo seeding now requires explicit opt-in and `SHWEPOS_SEED_PASSWORD`.

## Verification

- `npm run lint` passed.
- `npm run build` passed.
- `npm run vercel-build` passed, including `prisma migrate deploy`.
- Neon migration status is up to date.
- Template and generated workbook round-trip parsing passed.
