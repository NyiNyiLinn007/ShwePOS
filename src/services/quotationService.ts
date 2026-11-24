import prisma from '@/lib/prisma';
import { ApiError, type AuthUser } from '@/lib/apiAuth';
import { serializePrismaData } from '@/lib/number';
import { calculateLineAmounts, calculateOrderTotals } from '@/lib/saleCalculator';
import { getMyanmarDateCompact, parseMyanmarDateBoundary, roundQuantity } from '@/lib/utils';
import type { CreateQuotationInput, UpdateQuotationInput } from '@/lib/validations';
import type { QuotationDTO, QuotationStatus } from '@/types';
import { logAudit } from '@/services/auditService';

const quotationInclude = {
  customer: { select: { id: true, name: true, phone: true } },
  user: { select: { id: true, name: true } },
  items: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          nameMm: true,
          sku: true,
          unit: true,
          sellingPrice: true,
          stockQuantity: true,
          categoryId: true,
          imageUrl: true,
          productUnits: {
            orderBy: { conversionFactor: 'asc' as const },
          },
        },
      },
    },
  },
};

function parseValidUntil(dateStr: string): Date {
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    const parsed = parseMyanmarDateBoundary(dateStr, true);
    if (parsed) return parsed;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) throw new ApiError('Invalid validUntil date', 400);
  return d;
}

export async function listQuotations(): Promise<QuotationDTO[]> {
  const quotes = await prisma.quotation.findMany({
    include: quotationInclude,
    orderBy: { createdAt: 'desc' },
    take: 200,
  });
  return serializePrismaData(quotes).map((q) => ({
    ...q,
    status: q.status as QuotationStatus,
  }));
}

export async function createQuotation(input: CreateQuotationInput, user: AuthUser) {
  const created = await prisma.$transaction(
    async (tx) => {
      const settings = await tx.settings.findFirst({ where: { id: 'default' } });
      const taxRate = input.taxRate !== undefined ? input.taxRate : settings?.taxRate ?? 0;

      let customerName = input.customerName?.trim() || null;
      let customerPhone = input.customerPhone?.trim() || null;
      if (input.customerId) {
        const cust = await tx.customer.findUnique({
          where: { id: input.customerId },
          select: { name: true, phone: true },
        });
        if (!cust) throw new ApiError('Customer not found', 404);
        customerName = cust.name;
        customerPhone = cust.phone;
      }

      let subtotal = 0;
      const preparedItems = input.items.map((item) => {
        const qty = roundQuantity(item.quantity);
        const { gross, discount, total } = calculateLineAmounts(
          item.unitPrice,
          qty,
          item.discount || 0
        );
        subtotal += total;
        return {
          productId: item.productId,
          quantity: qty,
          unitName: item.unitName?.trim() || null,
          unitFactor: roundQuantity(item.unitFactor || 1),
          unitPrice: gross > 0 && qty > 0 ? Math.round(item.unitPrice) : 0,
          discount,
          total,
        };
      });

      const orderTotals = calculateOrderTotals({
        subtotal,
        itemDiscountTotal: 0,
        cartDiscount: input.discountAmount || 0,
        promotionDiscount: 0,
        loyaltyDiscount: 0,
        taxRate,
      });
      const discountAmount = orderTotals.cartDiscountAmount;
      const taxAmount = orderTotals.taxAmount;
      const totalAmount = orderTotals.totalAmount;

      const dateStr = getMyanmarDateCompact();
      const counterKey = `QT-${dateStr}`;
      const counter = await tx.invoiceCounter.upsert({
        where: { date: counterKey },
        create: { date: counterKey, counter: 1 },
        update: { counter: { increment: 1 } },
      });
      const quoteNumber = `QT-${dateStr}-${counter.counter.toString().padStart(4, '0')}`;

      const quote = await tx.quotation.create({
        data: {
          quoteNumber,
          customerId: input.customerId || null,
          customerName,
          customerPhone,
          userId: user.id,
          subtotal,
          discountAmount,
          taxAmount,
          totalAmount,
          status: input.status || 'SENT',
          validUntil: parseValidUntil(input.validUntil),
          notes: input.notes?.trim() || null,
          items: { create: preparedItems },
        },
        include: quotationInclude,
      });

      await logAudit(
        {
          userId: user.id,
          action: 'QUOTATION_CREATED',
          entityType: 'QUOTATION',
          entityId: quote.id,
          summary: `Created quotation ${quoteNumber} (${totalAmount} K) for ${customerName || 'Walk-in'}`,
          metadata: { quoteNumber, totalAmount, itemCount: preparedItems.length },
        },
        tx
      );

      return quote;
    },
    { maxWait: 10_000, timeout: 15_000 }
  );

  return serializePrismaData(created);
}

export async function updateQuotation(
  id: string,
  input: UpdateQuotationInput,
  user: AuthUser
) {
  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) throw new ApiError('Quotation not found', 404);
  if (user.role === 'CASHIER' && existing.userId !== user.id) {
    throw new ApiError('You can only modify your own quotations', 403);
  }
  if (existing.status === 'CONVERTED') {
    throw new ApiError('Converted quotations cannot be modified', 409);
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      ...(input.status !== undefined && { status: input.status }),
      ...(input.validUntil !== undefined && { validUntil: parseValidUntil(input.validUntil) }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
    },
    include: quotationInclude,
  });

  return serializePrismaData(updated);
}

export async function deleteQuotation(id: string, user: AuthUser) {
  const existing = await prisma.quotation.findUnique({ where: { id } });
  if (!existing) throw new ApiError('Quotation not found', 404);
  if (user.role === 'CASHIER' && existing.userId !== user.id) {
    throw new ApiError('You can only cancel your own quotations', 403);
  }
  if (existing.status === 'CONVERTED') {
    throw new ApiError('Converted quotations cannot be cancelled', 409);
  }
  const cancelled = await prisma.quotation.update({
    where: { id },
    data: { status: 'CANCELLED' },
    include: quotationInclude,
  });
  return serializePrismaData(cancelled);
}
