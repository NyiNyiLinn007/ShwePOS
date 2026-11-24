import prisma from '@/lib/prisma';
import { ApiError, type AuthUser } from '@/lib/apiAuth';
import { serializePrismaData } from '@/lib/number';
import { parseMyanmarDateBoundary } from '@/lib/utils';
import type { CreatePromotionInput, UpdatePromotionInput } from '@/lib/validations';
import type { PromotionDTO, PromotionType } from '@/types';
import { logAudit } from '@/services/auditService';

const promotionInclude = {
  category: { select: { id: true, name: true, nameMm: true } },
  product: { select: { id: true, name: true, nameMm: true, sku: true } },
};

function parsePromoBoundary(dateStr: string, endOfDay: boolean): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parsed = parseMyanmarDateBoundary(dateStr, endOfDay);
    if (parsed) return parsed;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    throw new ApiError(`Invalid date: ${dateStr}`, 400);
  }
  return d;
}

export async function listPromotions(): Promise<PromotionDTO[]> {
  const promos = await prisma.promotion.findMany({
    include: promotionInclude,
    orderBy: [{ isActive: 'desc' }, { startDate: 'desc' }],
  });
  return serializePrismaData(promos).map((p) => ({
    ...p,
    type: p.type as PromotionType,
  }));
}

export async function listActivePromotions(now: Date = new Date()): Promise<PromotionDTO[]> {
  const promos = await prisma.promotion.findMany({
    where: {
      isActive: true,
      startDate: { lte: now },
      endDate: { gte: now },
    },
    include: promotionInclude,
    orderBy: { createdAt: 'desc' },
  });
  return serializePrismaData(promos).map((p) => ({
    ...p,
    type: p.type as PromotionType,
  }));
}

export async function createPromotion(input: CreatePromotionInput, user: AuthUser) {
  const startDate = parsePromoBoundary(input.startDate, false);
  const endDate = parsePromoBoundary(input.endDate, true);
  if (endDate < startDate) {
    throw new ApiError('End date must be on or after start date', 400);
  }

  const normalizedCode = input.code?.trim().toUpperCase() || null;
  if (normalizedCode) {
    const dup = await prisma.promotion.findUnique({ where: { code: normalizedCode } });
    if (dup) {
      throw new ApiError(`Promo code "${normalizedCode}" already exists`, 409);
    }
  }

  const created = await prisma.promotion.create({
    data: {
      name: input.name.trim(),
      nameMm: input.nameMm?.trim() || null,
      code: normalizedCode,
      type: input.type,
      discountValue: input.discountValue ?? 0,
      minSpend: input.minSpend ?? null,
      buyQty: input.buyQty ?? null,
      getQty: input.getQty ?? null,
      categoryId: input.categoryId || null,
      productId: input.productId || null,
      startDate,
      endDate,
      usageLimit: input.usageLimit ?? null,
      isActive: input.isActive ?? true,
    },
    include: promotionInclude,
  });

  await logAudit({
    userId: user.id,
    action: 'PROMOTION_UPDATED',
    entityType: 'PROMOTION',
    entityId: created.id,
    summary: `Created promotion "${created.name}" (${created.type}${normalizedCode ? `, code: ${normalizedCode}` : ', auto'})`,
  });

  return serializePrismaData(created);
}

export async function updatePromotion(id: string, input: UpdatePromotionInput, user: AuthUser) {
  const existing = await prisma.promotion.findUnique({ where: { id } });
  if (!existing) throw new ApiError('Promotion not found', 404);

  const startDate = input.startDate ? parsePromoBoundary(input.startDate, false) : existing.startDate;
  const endDate = input.endDate ? parsePromoBoundary(input.endDate, true) : existing.endDate;
  if (endDate < startDate) {
    throw new ApiError('End date must be on or after start date', 400);
  }

  const normalizedCode =
    input.code !== undefined ? input.code?.trim().toUpperCase() || null : existing.code;
  if (normalizedCode && normalizedCode !== existing.code) {
    const dup = await prisma.promotion.findUnique({ where: { code: normalizedCode } });
    if (dup) {
      throw new ApiError(`Promo code "${normalizedCode}" already exists`, 409);
    }
  }

  const updated = await prisma.promotion.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.nameMm !== undefined && { nameMm: input.nameMm?.trim() || null }),
      ...(input.code !== undefined && { code: normalizedCode }),
      ...(input.type !== undefined && { type: input.type }),
      ...(input.discountValue !== undefined && { discountValue: input.discountValue }),
      ...(input.minSpend !== undefined && { minSpend: input.minSpend }),
      ...(input.buyQty !== undefined && { buyQty: input.buyQty }),
      ...(input.getQty !== undefined && { getQty: input.getQty }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId || null }),
      ...(input.productId !== undefined && { productId: input.productId || null }),
      startDate,
      endDate,
      ...(input.usageLimit !== undefined && { usageLimit: input.usageLimit }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
    include: promotionInclude,
  });

  await logAudit({
    userId: user.id,
    action: 'PROMOTION_UPDATED',
    entityType: 'PROMOTION',
    entityId: updated.id,
    summary: `Updated promotion "${updated.name}" (active: ${updated.isActive})`,
  });

  return serializePrismaData(updated);
}

export async function deletePromotion(id: string) {
  const existing = await prisma.promotion.findUnique({
    where: { id },
    include: { _count: { select: { sales: true } } },
  });
  if (!existing) throw new ApiError('Promotion not found', 404);

  if (existing._count.sales > 0) {
    const deactivated = await prisma.promotion.update({
      where: { id },
      data: { isActive: false },
    });
    return { deactivated: true, promotion: serializePrismaData(deactivated) };
  }

  await prisma.promotion.delete({ where: { id } });
  return { deleted: true };
}
