# ShwePOS

ShwePOS is a Next.js, NextAuth, Prisma, and PostgreSQL point-of-sale application.

## Setup

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy environment variables:

   ```bash
   copy .env.example .env
   ```

3. Set these production values before deploy:

   - `DATABASE_URL`
   - `NEXTAUTH_SECRET`
   - `NEXTAUTH_URL`

4. Generate Prisma Client:

   ```bash
   npm run db:generate
   ```

## Database Workflow

Use versioned migrations for reviewed schema changes.

```bash
npm run db:migrate
npm run db:migrate:deploy
```

`npm run db:push` is kept only for throwaway local prototypes. Do not use it for production or shared environments.

## Seeding

Seed only disposable development databases unless the seed file has been reviewed for production safety.

```bash
npm run db:seed
```

## Development

```bash
npm run dev
```

## Production

```bash
npm run build
npm run db:migrate:deploy
npm run start
```

## Backup And Restore

Before deploying migrations or POS accounting changes:

```bash
pg_dump "$DATABASE_URL" > backup.sql
```

Restore into a clean database and verify before pointing production traffic at it:

```bash
psql "$DATABASE_URL" < backup.sql
```

## Operational Notes

- Run cash/card/mobile payment reconciliation at day close.
- Keep printer and payment device configuration outside git.
- Rotate `NEXTAUTH_SECRET` only with a planned user logout window.
- Use HTTPS in production so cookies and origin checks behave correctly.
- Review inventory movement history after refunds and voids.

## Accounting Roadmap

The schema now includes initial payment metadata, refund/void adjustment records, shifts, and cash drawer movements. Before production cash control, finish:

- Decimal or integer minor-unit money columns.
- Shift open/close UI and enforcement before cash sales.
- Cash drawer close-out reports and variance approvals.
- Payment device or gateway status callbacks.
- External payment reconciliation reports.
