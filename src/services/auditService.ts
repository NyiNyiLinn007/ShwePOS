import type { Prisma, PrismaClient } from '@prisma/client';
import prisma from '@/lib/prisma';
import { parseMyanmarDateBoundary } from '@/lib/utils';

export type AuditAction =
  | 'SALE_VOID'
  | 'SALE_REFUND'
  | 'SALE_PARTIAL_REFUND'
  | 'PRICE_OVERRIDE'
  | 'PRODUCT_PRICE_CHANGE'
  | 'STOCK_ADJUSTMENT'
  | 'PURCHASE_ORDER_CREATED'
  | 'PURCHASE_ORDER_CANCELLED'
  | 'SUPPLIER_DEBT_REPAYMENT'
  | 'CUSTOMER_DEBT_REPAYMENT'
  | 'SHIFT_CLOSED'
  | 'USER_UPDATED'
  | 'SETTINGS_UPDATED'
  | 'DATA_MIGRATION_IMPORT';

export type AuditEntityType =
  | 'SALE'
  | 'PRODUCT'
  | 'INVENTORY'
  | 'CUSTOMER'
  | 'SUPPLIER'
  | 'PURCHASE_ORDER'
  | 'SHIFT'
  | 'USER'
  | 'SETTINGS'
  | 'DATA_MIGRATION';

export interface AuditLogInput {
  userId: string;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
}

type PrismaLike = PrismaClient | Prisma.TransactionClient;

/**
 * Records an immutable security/activity audit trail entry.
 * Works both inside a Prisma $transaction (pass `tx`) and standalone (defaults to `prisma`).
 */
export async function logAudit(
  input: AuditLogInput,
  db: PrismaLike = prisma
): Promise<void> {
  try {
    await db.auditLog.create({
      data: {
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId ?? null,
        summary: input.summary.slice(0, 500),
        metadata: input.metadata ?? undefined,
      },
    });
  } catch (err) {
    // Audit logging should never break primary POS checkout if table is migrating
    console.error('[AuditLog] Failed to persist audit entry:', err);
  }
}

export interface ListAuditLogsFilters {
  startDate?: string | null;
  endDate?: string | null;
  action?: string | null;
  entityType?: string | null;
  userId?: string | null;
  search?: string | null;
  page?: number;
  limit?: number;
}

export async function listAuditLogs(filters: ListAuditLogsFilters) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(200, Math.max(1, filters.limit ?? 50));

  const where: Prisma.AuditLogWhereInput = {};

  if (filters.action) {
    where.action = filters.action;
  }
  if (filters.entityType) {
    where.entityType = filters.entityType;
  }
  if (filters.userId) {
    where.userId = filters.userId;
  }
  if (filters.search && filters.search.trim()) {
    where.OR = [
      { summary: { contains: filters.search.trim(), mode: 'insensitive' } },
      { entityId: { contains: filters.search.trim(), mode: 'insensitive' } },
    ];
  }
  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      const start = parseMyanmarDateBoundary(filters.startDate, false);
      if (start) where.createdAt.gte = start;
    }
    if (filters.endDate) {
      const end = parseMyanmarDateBoundary(filters.endDate, true);
      if (end) where.createdAt.lte = end;
    }
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return {
    logs: logs.map((l) => ({
      ...l,
      createdAt: l.createdAt.toISOString(),
    })),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    },
  };
}
