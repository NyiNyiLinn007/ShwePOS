import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, requireRole, handleApiError, ApiError, validateCsrf } from '@/lib/apiAuth';
import { updateSaleStatusSchema } from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import { roundQuantity } from '@/lib/utils';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth();
    const { id } = await params;

    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                nameMm: true,
                sku: true,
                barcode: true,
                unit: true,
              },
            },
          },
        },
        payments: true,
        adjustments: {
          include: {
            approver: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true },
        },
        user: {
          select: { id: true, name: true },
        },
      },
    });

    if (!sale) {
      return NextResponse.json(
        { error: 'Sale not found' },
        { status: 404 }
      );
    }

    // Cashier can only view their own sales
    if (user.role === 'CASHIER' && sale.userId !== user.id) {
      return NextResponse.json({ error: 'Sale not found' }, { status: 404 });
    }

    return NextResponse.json(serializePrismaData(sale));
  } catch (error) {
    return handleApiError(error, 'Failed to fetch sale');
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);

    const user = await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const body = await request.json();

    const parsed = updateSaleStatusSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const { status: requestedStatus, reason, refundMethod, items: requestedItems } = parsed.data;

    const updatedSale = await prisma.$transaction(async (tx) => {
      const existingSale = await tx.sale.findUnique({
        where: { id },
        include: {
          items: true,
          payments: true,
          cashDrawerMovements: {
            where: { type: 'CASH_SALE' },
            select: { shiftId: true },
            take: 1,
          },
        },
      });

      if (!existingSale) {
        throw new ApiError('Sale not found', 404);
      }

      if (existingSale.status === 'REFUNDED' || existingSale.status === 'VOIDED') {
        throw new ApiError(
          `Cannot ${requestedStatus.toLowerCase()} — sale is already ${existingSale.status}`,
          409
        );
      }

      // Determine which items and quantities are being refunded
      const isPartialRequest = Array.isArray(requestedItems) && requestedItems.length > 0 && requestedStatus !== 'VOIDED';
      const refundLines: Array<{
        saleItem: typeof existingSale.items[number];
        refundQty: number;
        lineRefundAmount: number;
      }> = [];

      if (isPartialRequest) {
        const itemMap = new Map(existingSale.items.map((i) => [i.id, i]));
        for (const reqItem of requestedItems!) {
          const saleItem = itemMap.get(reqItem.saleItemId);
          if (!saleItem) {
            throw new ApiError(`Sale item not found: ${reqItem.saleItemId}`, 400);
          }
          const origQty = toNumber(saleItem.quantity);
          const alreadyRefunded = toNumber(saleItem.refundedQuantity);
          const remainingQty = roundQuantity(origQty - alreadyRefunded);
          const reqQty = roundQuantity(reqItem.quantity);
          if (reqQty <= 0 || reqQty > remainingQty) {
            throw new ApiError(
              `Invalid refund quantity (${reqQty}) for item. Remaining refundable: ${remainingQty}`,
              400
            );
          }
          const unitEffective = origQty > 0 ? toNumber(saleItem.total) / origQty : toNumber(saleItem.unitPrice);
          const lineRefundAmount = roundMoney(unitEffective * reqQty);
          refundLines.push({ saleItem, refundQty: reqQty, lineRefundAmount });
        }
      } else {
        for (const saleItem of existingSale.items) {
          const origQty = toNumber(saleItem.quantity);
          const alreadyRefunded = toNumber(saleItem.refundedQuantity);
          const remainingQty = roundQuantity(origQty - alreadyRefunded);
          if (remainingQty > 0) {
            const unitEffective = origQty > 0 ? toNumber(saleItem.total) / origQty : toNumber(saleItem.unitPrice);
            const lineRefundAmount = roundMoney(unitEffective * remainingQty);
            refundLines.push({ saleItem, refundQty: remainingQty, lineRefundAmount });
          }
        }
      }

      if (refundLines.length === 0) {
        throw new ApiError('No refundable items remaining on this sale', 400);
      }

      // Check if all items in the sale will now be completely refunded
      const refundQtyByItemId = new Map(refundLines.map((l) => [l.saleItem.id, l.refundQty]));
      const allItemsFullyRefunded = existingSale.items.every((item) => {
        const nextRefunded = roundQuantity(
          toNumber(item.refundedQuantity) + (refundQtyByItemId.get(item.id) ?? 0)
        );
        return nextRefunded >= roundQuantity(toNumber(item.quantity));
      });

      const finalStatus =
        requestedStatus === 'VOIDED'
          ? 'VOIDED'
          : allItemsFullyRefunded
            ? 'REFUNDED'
            : 'PARTIALLY_REFUNDED';

      // Calculate total refund amount (proportional to sale totalAmount)
      const currentSaleSubtotal = existingSale.items.reduce((sum, i) => {
        const rem = Math.max(0, toNumber(i.quantity) - toNumber(i.refundedQuantity));
        const orig = toNumber(i.quantity);
        return sum + (orig > 0 ? (toNumber(i.total) * rem) / orig : 0);
      }, 0);
      const rawLinesRefund = refundLines.reduce((sum, l) => sum + l.lineRefundAmount, 0);
      const saleTotalNumber = toNumber(existingSale.totalAmount);
      const refundAmount = allItemsFullyRefunded
        ? saleTotalNumber
        : currentSaleSubtotal > 0
          ? roundMoney(Math.min(saleTotalNumber, (rawLinesRefund / currentSaleSubtotal) * saleTotalNumber))
          : roundMoney(Math.min(saleTotalNumber, rawLinesRefund));

      // Determine whether this refund affects the cash drawer
      const isCashReversal =
        existingSale.paymentMethod === 'CASH' ||
        refundMethod === 'CASH' ||
        (existingSale.paymentMethod === 'SPLIT' &&
          existingSale.payments.some((p) => p.method === 'CASH'));

      // Resolve open shift: 1) Manager's open shift, 2) Original cashier's open shift, 3) Any open shift
      let targetShiftId: string | null = null;
      if (isCashReversal) {
        const openShift =
          (await tx.shift.findFirst({
            where: { userId: user.id, status: 'OPEN' },
            select: { id: true },
            orderBy: { openedAt: 'desc' },
          })) ??
          (await tx.shift.findFirst({
            where: { userId: existingSale.userId, status: 'OPEN' },
            select: { id: true },
            orderBy: { openedAt: 'desc' },
          })) ??
          (await tx.shift.findFirst({
            where: { status: 'OPEN' },
            select: { id: true },
            orderBy: { openedAt: 'desc' },
          }));

        if (!openShift) {
          throw new ApiError(
            'Open a cashier or manager shift before processing a cash refund/void',
            409
          );
        }
        targetShiftId = openShift.id;
      }

      // Optimistic status update & total adjustment
      const updatedNotes = existingSale.notes
        ? `${existingSale.notes} | [${finalStatus} by ${user.name}] ${reason}`
        : `[${finalStatus} by ${user.name}] ${reason}`;

      const newTotalAmount =
        finalStatus === 'PARTIALLY_REFUNDED'
          ? roundMoney(Math.max(0, saleTotalNumber - refundAmount))
          : existingSale.totalAmount;

      const currentDue = toNumber(existingSale.dueAmount);
      const debtReduction = roundMoney(Math.min(currentDue, refundAmount));
      const cashRefundOut = roundMoney(Math.max(0, refundAmount - debtReduction));

      const transitioned = await tx.sale.updateMany({
        where: { id, status: existingSale.status },
        data: {
          status: finalStatus,
          totalAmount: newTotalAmount,
          dueAmount: roundMoney(Math.max(0, currentDue - debtReduction)),
          paymentStatus:
            finalStatus === 'REFUNDED' || finalStatus === 'VOIDED'
              ? 'REVERSED'
              : existingSale.paymentStatus,
          notes: updatedNotes.slice(0, 500),
        },
      });

      if (transitioned.count === 0) {
        throw new ApiError('Sale was modified by another request. Please refresh and try again.', 409);
      }

      await tx.saleAdjustment.create({
        data: {
          saleId: existingSale.id,
          approverUserId: user.id,
          type:
            finalStatus === 'VOIDED'
              ? 'VOID'
              : finalStatus === 'PARTIALLY_REFUNDED'
                ? 'PARTIAL_REFUND'
                : 'REFUND',
          reason,
          amount: refundAmount,
          paymentMethod: refundMethod === 'CASH' ? 'CASH' : existingSale.paymentMethod,
          paymentReversalStatus: 'COMPLETED',
        },
      });

      // Update refundedQuantity and restore stock for each refunded line
      for (const { saleItem, refundQty } of refundLines) {
        await tx.saleItem.update({
          where: { id: saleItem.id },
          data: {
            refundedQuantity: { increment: refundQty },
          },
        });

        await tx.product.update({
          where: { id: saleItem.productId },
          data: {
            stockQuantity: { increment: refundQty },
          },
        });

        const product = await tx.product.findUnique({
          where: { id: saleItem.productId },
          select: { stockQuantity: true },
        });
        const newStock = roundQuantity(toNumber(product?.stockQuantity));

        await tx.stockMovement.create({
          data: {
            productId: saleItem.productId,
            userId: user.id,
            saleId: existingSale.id,
            quantity: refundQty,
            type: 'RETURN',
            reason: `${finalStatus}: ${reason} (Invoice: ${existingSale.invoiceNumber})`,
            previousStock: roundQuantity(newStock - refundQty),
            newStock,
          },
        });
      }

      // Reverse customer purchase total and creditBalance if applicable
      if (existingSale.customerId) {
        await tx.customer.update({
          where: { id: existingSale.customerId },
          data: {
            totalPurchases: { decrement: refundAmount },
            ...(debtReduction > 0 && { creditBalance: { decrement: debtReduction } }),
          },
        });
      }

      if (isCashReversal && targetShiftId && cashRefundOut > 0) {
        await tx.cashDrawerMovement.create({
          data: {
            shiftId: targetShiftId,
            saleId: existingSale.id,
            userId: user.id,
            type: finalStatus === 'VOIDED' ? 'VOID' : 'REFUND',
            amount: -cashRefundOut,
            reason: `${finalStatus}: ${reason} (Invoice: ${existingSale.invoiceNumber})`,
          },
        });
      }

      // Fetch updated sale with full includes for response
      const finalSale = await tx.sale.findUnique({
        where: { id },
        include: {
          items: {
            include: {
              product: {
                select: { id: true, name: true, nameMm: true, sku: true, unit: true },
              },
            },
          },
          payments: true,
          customer: {
            select: { id: true, name: true, phone: true },
          },
          user: {
            select: { id: true, name: true },
          },
        },
      });

      return finalSale;
    }, { maxWait: 10000, timeout: 15000 });

    return NextResponse.json(serializePrismaData(updatedSale));
  } catch (error) {
    return handleApiError(error, 'Failed to update sale');
  }
}
