import prisma from '@/lib/prisma';
import { ApiError, AuthUser } from '@/lib/apiAuth';
import { CreateSaleInput, UpdateSaleStatusInput } from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import {
  getMyanmarDateCompact,
  isFractionalUnit,
  parseMyanmarDateBoundary,
  roundQuantity,
} from '@/lib/utils';

const MAX_INVOICE_RETRIES = 3;

const saleResponseInclude = {
  items: {
    include: {
      product: { select: { name: true, nameMm: true, sku: true, unit: true } },
    },
  },
  payments: true,
  customer: {
    select: {
      id: true,
      name: true,
      phone: true,
      loyaltyPoints: true,
      creditBalance: true,
    },
  },
  user: { select: { id: true, name: true } },
} as const;

function isUniqueConstraintError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === 'object' &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  );
}

function findExistingSaleByClientSaleId(clientSaleId: string) {
  return prisma.sale.findUnique({
    where: { clientSaleId },
    include: saleResponseInclude,
  });
}

export interface ListSalesFilters {
  startDate?: string | null;
  endDate?: string | null;
  status?: string | null;
  paymentMethod?: string | null;
  page?: number;
  limit?: number;
}

export async function listSales(filters: ListSalesFilters, user: AuthUser) {
  const page = Math.max(1, filters.page ?? 1);
  const limit = Math.min(100, Math.max(1, filters.limit ?? 50));

  const where: Record<string, unknown> = {};
  if (user.role === 'CASHIER') {
    where.userId = user.id;
  }

  if (filters.startDate || filters.endDate) {
    where.createdAt = {};
    if (filters.startDate) {
      const start = parseMyanmarDateBoundary(filters.startDate, false);
      if (!start) throw new ApiError('Invalid startDate', 400);
      (where.createdAt as Record<string, unknown>).gte = start;
    }
    if (filters.endDate) {
      const end = parseMyanmarDateBoundary(filters.endDate, true);
      if (!end) throw new ApiError('Invalid endDate', 400);
      (where.createdAt as Record<string, unknown>).lte = end;
    }
  }

  if (filters.status) {
    where.status = filters.status;
  }

  if (filters.paymentMethod) {
    where.paymentMethod = filters.paymentMethod;
  }

  const [sales, total] = await Promise.all([
    prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: {
              select: { name: true, nameMm: true, sku: true, unit: true },
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
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.sale.count({ where }),
  ]);

  return {
    sales: serializePrismaData(sales),
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
}

export async function getSaleById(id: string, user: AuthUser) {
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

  if (!sale || (user.role === 'CASHIER' && sale.userId !== user.id)) {
    throw new ApiError('Sale not found', 404);
  }

  return serializePrismaData(sale);
}

export async function createSale(
  input: CreateSaleInput,
  user: AuthUser
): Promise<{ sale: unknown; created: boolean }> {
  const {
    items,
    customerId,
    paymentMethod,
    paidAmount,
    payments: inputPayments,
    pointsRedeemed,
    cartDiscount,
    clientSaleId,
    paymentReference,
    notes,
  } = input;

  const cleanPaymentReference = paymentReference?.trim() || null;

  if (clientSaleId) {
    const existingSale = await findExistingSaleByClientSaleId(clientSaleId);
    if (existingSale) {
      return { sale: serializePrismaData(existingSale), created: false };
    }
  }

  let lastError: unknown = null;
  for (let attempt = 0; attempt < MAX_INVOICE_RETRIES; attempt++) {
    try {
      const sale = await prisma.$transaction(
        async (tx) => {
          const dateStr = getMyanmarDateCompact();

          const counter = await tx.invoiceCounter.upsert({
            where: { date: dateStr },
            create: { date: dateStr, counter: 1 },
            update: { counter: { increment: 1 } },
          });
          const invoiceNumber = `INV-${dateStr}-${counter.counter.toString().padStart(4, '0')}`;

          const productIds = items.map((i) => i.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true,
              name: true,
              nameMm: true,
              sku: true,
              unit: true,
              sellingPrice: true,
              costPrice: true,
              stockQuantity: true,
              isActive: true,
            },
          });

          const productMap = new Map(products.map((p) => [p.id, p]));

          const settings = await tx.settings.findUnique({
            where: { id: 'default' },
          });
          const taxRate = settings?.taxRate ?? 0;
          const loyaltyEnabled = settings?.loyaltyEnabled ?? true;
          const loyaltyEarnRate = Math.max(1, toNumber(settings?.loyaltyEarnRate ?? 1000));
          const loyaltyRedeemRate = Math.max(0, toNumber(settings?.loyaltyRedeemRate ?? 10));

          let customerRecord: {
            id: string;
            name: string;
            loyaltyPoints: number;
            creditBalance: number;
            creditLimit: number | null;
          } | null = null;

          if (customerId) {
            const cust = await tx.customer.findUnique({
              where: { id: customerId },
              select: {
                id: true,
                name: true,
                loyaltyPoints: true,
                creditBalance: true,
                creditLimit: true,
              },
            });
            if (!cust) {
              throw new ApiError('Customer not found', 400);
            }
            customerRecord = {
              id: cust.id,
              name: cust.name,
              loyaltyPoints: cust.loyaltyPoints,
              creditBalance: toNumber(cust.creditBalance),
              creditLimit: cust.creditLimit !== null ? toNumber(cust.creditLimit) : null,
            };
          }

          if (pointsRedeemed > 0) {
            if (!customerRecord) {
              throw new ApiError('Customer is required to redeem loyalty points', 400);
            }
            if (!loyaltyEnabled) {
              throw new ApiError('Loyalty points program is currently disabled', 400);
            }
            if (pointsRedeemed > customerRecord.loyaltyPoints) {
              throw new ApiError(
                `Insufficient loyalty points. Available: ${customerRecord.loyaltyPoints}`,
                400
              );
            }
          }

          let subtotal = 0;
          let totalDiscount = 0;
          const stockDeductions = new Map<string, number>();
          const saleItemsData: Array<{
            productId: string;
            quantity: number;
            unitPrice: number;
            costPrice: number;
            discount: number;
            total: number;
          }> = [];

          for (const item of items) {
            const product = productMap.get(item.productId);
            if (!product) {
              throw new ApiError(`Product not found: ${item.productId}`, 400);
            }
            if (!product.isActive) {
              throw new ApiError(`Product is inactive: ${product.name}`, 400);
            }

            const qty = roundQuantity(item.quantity);
            if (!isFractionalUnit(product.unit) && !Number.isInteger(qty)) {
              throw new ApiError(
                `Fractional quantity (${qty}) is not allowed for unit '${product.unit}' on ${product.name}`,
                400
              );
            }

            const sellingPrice = toNumber(product.sellingPrice);
            const costPrice = toNumber(product.costPrice);
            const itemSubtotal = roundMoney(sellingPrice * qty);
            const itemDiscount = roundMoney(Math.min(item.discount || 0, itemSubtotal));
            if (itemDiscount < 0) {
              throw new ApiError('Discount cannot be negative', 400);
            }
            const itemTotal = roundMoney(itemSubtotal - itemDiscount);

            subtotal = roundMoney(subtotal + itemSubtotal);
            totalDiscount = roundMoney(totalDiscount + itemDiscount);

            saleItemsData.push({
              productId: item.productId,
              quantity: qty,
              unitPrice: sellingPrice,
              costPrice,
              discount: itemDiscount,
              total: itemTotal,
            });
            stockDeductions.set(
              item.productId,
              roundQuantity((stockDeductions.get(item.productId) ?? 0) + qty)
            );
          }

          const totalItemDiscount = totalDiscount;
          const maxRemainingAfterItem = Math.max(0, subtotal - totalItemDiscount);
          const cartDiscountAmount = roundMoney(Math.min(cartDiscount || 0, maxRemainingAfterItem));
          const maxRemainingAfterCart = Math.max(0, maxRemainingAfterItem - cartDiscountAmount);
          const loyaltyDiscountAmount =
            pointsRedeemed > 0
              ? roundMoney(Math.min(pointsRedeemed * loyaltyRedeemRate, maxRemainingAfterCart))
              : 0;
          const effectiveDiscount = roundMoney(
            totalItemDiscount + cartDiscountAmount + loyaltyDiscountAmount
          );
          const discountedSubtotal = roundMoney(Math.max(0, subtotal - effectiveDiscount));
          const taxAmount = roundMoney(discountedSubtotal * (taxRate / 100));
          const totalAmount = roundMoney(discountedSubtotal + taxAmount);

          const normalizedLegs: Array<{
            method: 'CASH' | 'CARD' | 'MOBILE_BANKING' | 'CREDIT';
            amount: number;
            reference: string | null;
          }> = [];

          let finalPaid = 0;
          let dueAmount = 0;
          let changeAmount = 0;

          if (paymentMethod === 'SPLIT') {
            if (!inputPayments || inputPayments.length === 0) {
              throw new ApiError('Split payment requires payment legs', 400);
            }
            let nonCreditSum = 0;
            let creditSum = 0;
            let cashSum = 0;

            for (const leg of inputPayments) {
              const amt = roundMoney(leg.amount);
              const ref = leg.reference?.trim() || null;
              if ((leg.method === 'CARD' || leg.method === 'MOBILE_BANKING') && !ref) {
                throw new ApiError(`Payment reference is required for ${leg.method} leg`, 400);
              }
              if (leg.method === 'CREDIT') {
                creditSum = roundMoney(creditSum + amt);
              } else {
                nonCreditSum = roundMoney(nonCreditSum + amt);
                if (leg.method === 'CASH') {
                  cashSum = roundMoney(cashSum + amt);
                }
              }
              normalizedLegs.push({ method: leg.method, amount: amt, reference: ref });
            }

            const totalCovered = roundMoney(nonCreditSum + creditSum);
            if (totalCovered < totalAmount) {
              throw new ApiError(
                `Split payments (${totalCovered}) do not cover total (${totalAmount})`,
                400
              );
            }
            const excess = roundMoney(totalCovered - totalAmount);
            if (excess > cashSum) {
              throw new ApiError('Non-cash split payment legs cannot exceed the sale total', 400);
            }
            changeAmount = excess;
            finalPaid = nonCreditSum;
            dueAmount = creditSum;
          } else if (paymentMethod === 'CREDIT') {
            if (!customerRecord) {
              throw new ApiError('Customer is required for credit sales', 400);
            }
            const upfrontCash = roundMoney(Math.min(paidAmount || 0, totalAmount));
            finalPaid = upfrontCash;
            dueAmount = roundMoney(totalAmount - upfrontCash);
            changeAmount = 0;
            if (upfrontCash > 0) {
              normalizedLegs.push({ method: 'CASH', amount: upfrontCash, reference: null });
            }
            if (dueAmount > 0) {
              normalizedLegs.push({
                method: 'CREDIT',
                amount: dueAmount,
                reference: cleanPaymentReference,
              });
            }
          } else if (paymentMethod === 'CASH') {
            if (paidAmount < totalAmount) {
              throw new ApiError(
                `Insufficient payment. Total: ${totalAmount}, Paid: ${paidAmount}`,
                400
              );
            }
            finalPaid = roundMoney(paidAmount);
            changeAmount = roundMoney(paidAmount - totalAmount);
            dueAmount = 0;
            normalizedLegs.push({ method: 'CASH', amount: totalAmount, reference: null });
          } else {
            if (!cleanPaymentReference) {
              throw new ApiError('Payment reference is required for non-cash payments', 400);
            }
            finalPaid = totalAmount;
            changeAmount = 0;
            dueAmount = 0;
            normalizedLegs.push({
              method: paymentMethod,
              amount: totalAmount,
              reference: cleanPaymentReference,
            });
          }

          if (dueAmount > 0) {
            if (!customerRecord) {
              throw new ApiError('Customer is required when recording credit balance', 400);
            }
            if (
              customerRecord.creditLimit !== null &&
              roundMoney(customerRecord.creditBalance + dueAmount) > customerRecord.creditLimit
            ) {
              throw new ApiError(
                `Credit limit exceeded. Limit: ${customerRecord.creditLimit}, Current balance: ${customerRecord.creditBalance}, New credit: ${dueAmount}`,
                400
              );
            }
          }

          const grossCashLegs = normalizedLegs
            .filter((l) => l.method === 'CASH')
            .reduce((sum, l) => roundMoney(sum + l.amount), 0);
          const netCashCollected =
            paymentMethod === 'SPLIT'
              ? roundMoney(Math.max(0, grossCashLegs - changeAmount))
              : grossCashLegs;

          const openShift =
            netCashCollected > 0
              ? await tx.shift.findFirst({
                  where: { userId: user.id, status: 'OPEN' },
                  select: { id: true },
                  orderBy: { openedAt: 'desc' },
                })
              : null;

          if (netCashCollected > 0 && !openShift) {
            throw new ApiError('Open a cashier shift before recording a cash sale', 409);
          }

          const stockMovementsData: Array<{
            productId: string;
            quantity: number;
            previousStock: number;
            newStock: number;
          }> = [];

          for (const [productId, quantity] of stockDeductions) {
            const result = await tx.product.updateMany({
              where: {
                id: productId,
                stockQuantity: { gte: quantity },
              },
              data: {
                stockQuantity: { decrement: quantity },
              },
            });
            if (result.count === 0) {
              const currentProduct =
                (await tx.product.findUnique({
                  where: { id: productId },
                  select: { name: true, stockQuantity: true },
                })) ?? productMap.get(productId);
              throw new ApiError(
                `Insufficient stock for ${currentProduct?.name ?? 'product'}. Available: ${toNumber(currentProduct?.stockQuantity)}`,
                409
              );
            }

            const updatedProduct = await tx.product.findUnique({
              where: { id: productId },
              select: { stockQuantity: true },
            });
            const newStock = roundQuantity(toNumber(updatedProduct?.stockQuantity));
            stockMovementsData.push({
              productId,
              quantity,
              previousStock: roundQuantity(newStock + quantity),
              newStock,
            });
          }

          const pointsEarned =
            customerRecord && loyaltyEnabled
              ? Math.floor(Math.max(0, totalAmount - dueAmount) / loyaltyEarnRate)
              : 0;

          const paymentStatus =
            dueAmount > 0 ? (finalPaid > 0 ? 'PARTIAL' : 'PENDING') : 'PAID';

          const newSale = await tx.sale.create({
            data: {
              invoiceNumber,
              clientSaleId: clientSaleId || null,
              customerId: customerId || null,
              userId: user.id,
              subtotal,
              discountAmount: effectiveDiscount,
              taxAmount,
              totalAmount,
              paidAmount: finalPaid,
              dueAmount,
              changeAmount,
              pointsEarned,
              pointsRedeemed,
              paymentMethod,
              paymentStatus,
              paymentReference: cleanPaymentReference,
              paymentProviderResponse: null,
              notes: notes || null,
              status: 'COMPLETED',
              items: {
                create: saleItemsData.map((item) => ({
                  productId: item.productId,
                  quantity: item.quantity,
                  unitPrice: item.unitPrice,
                  costPrice: item.costPrice,
                  discount: item.discount,
                  total: item.total,
                })),
              },
              payments: {
                create: normalizedLegs.map((leg) => ({
                  customerId: customerId || null,
                  userId: user.id,
                  shiftId: leg.method === 'CASH' ? openShift?.id ?? null : null,
                  method: leg.method,
                  amount:
                    leg.method === 'CASH' && paymentMethod === 'SPLIT'
                      ? roundMoney(Math.max(0, leg.amount - changeAmount))
                      : leg.amount,
                  reference: leg.reference,
                  type: 'CHECKOUT',
                })),
              },
            },
            include: saleResponseInclude,
          });

          for (const movement of stockMovementsData) {
            await tx.stockMovement.create({
              data: {
                productId: movement.productId,
                userId: user.id,
                saleId: newSale.id,
                quantity: movement.quantity,
                type: 'OUT',
                reason: `Sale: ${invoiceNumber}`,
                previousStock: movement.previousStock,
                newStock: movement.newStock,
              },
            });
          }

          if (customerRecord) {
            const netPointsDelta = pointsEarned - pointsRedeemed;
            await tx.customer.update({
              where: { id: customerRecord.id },
              data: {
                totalPurchases: { increment: totalAmount },
                ...(dueAmount > 0 && { creditBalance: { increment: dueAmount } }),
                ...(netPointsDelta !== 0 && { loyaltyPoints: { increment: netPointsDelta } }),
              },
            });
          }

          if (netCashCollected > 0 && openShift) {
            await tx.cashDrawerMovement.create({
              data: {
                shiftId: openShift.id,
                saleId: newSale.id,
                userId: user.id,
                type: 'CASH_SALE',
                amount: netCashCollected,
                reason: `Sale: ${invoiceNumber}`,
              },
            });
          }

          return newSale;
        },
        { maxWait: 10000, timeout: 15000 }
      );

      return { sale: serializePrismaData(sale), created: true };
    } catch (e: unknown) {
      if (isUniqueConstraintError(e)) {
        if (clientSaleId) {
          const existingSale = await findExistingSaleByClientSaleId(clientSaleId);
          if (existingSale) {
            return { sale: serializePrismaData(existingSale), created: false };
          }
        }
        lastError = e;
        continue;
      }
      throw e;
    }
  }

  console.error('Invoice generation failed after retries:', lastError);
  throw new ApiError('Failed to generate unique invoice number. Please try again.', 500);
}

export async function refundOrVoidSale(
  id: string,
  input: UpdateSaleStatusInput,
  user: AuthUser
) {
  const { status: requestedStatus, reason, refundMethod, items: requestedItems } = input;

  const updatedSale = await prisma.$transaction(
    async (tx) => {
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

      const isPartialRequest =
        Array.isArray(requestedItems) &&
        requestedItems.length > 0 &&
        requestedStatus !== 'VOIDED';
      const refundLines: Array<{
        saleItem: (typeof existingSale.items)[number];
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
          const unitEffective =
            origQty > 0 ? toNumber(saleItem.total) / origQty : toNumber(saleItem.unitPrice);
          const lineRefundAmount = roundMoney(unitEffective * reqQty);
          refundLines.push({ saleItem, refundQty: reqQty, lineRefundAmount });
        }
      } else {
        for (const saleItem of existingSale.items) {
          const origQty = toNumber(saleItem.quantity);
          const alreadyRefunded = toNumber(saleItem.refundedQuantity);
          const remainingQty = roundQuantity(origQty - alreadyRefunded);
          if (remainingQty > 0) {
            const unitEffective =
              origQty > 0 ? toNumber(saleItem.total) / origQty : toNumber(saleItem.unitPrice);
            const lineRefundAmount = roundMoney(unitEffective * remainingQty);
            refundLines.push({ saleItem, refundQty: remainingQty, lineRefundAmount });
          }
        }
      }

      if (refundLines.length === 0) {
        throw new ApiError('No refundable items remaining on this sale', 400);
      }

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
          ? roundMoney(
              Math.min(saleTotalNumber, (rawLinesRefund / currentSaleSubtotal) * saleTotalNumber)
            )
          : roundMoney(Math.min(saleTotalNumber, rawLinesRefund));

      const isCashReversal =
        existingSale.paymentMethod === 'CASH' ||
        refundMethod === 'CASH' ||
        (existingSale.paymentMethod === 'SPLIT' &&
          existingSale.payments.some((p) => p.method === 'CASH'));

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
        throw new ApiError(
          'Sale was modified by another request. Please refresh and try again.',
          409
        );
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
    },
    { maxWait: 10000, timeout: 15000 }
  );

  return serializePrismaData(updatedSale);
}
