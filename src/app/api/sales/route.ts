import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, handleApiError, ApiError, validateCsrf } from '@/lib/apiAuth';
import { createSaleSchema } from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import {
  getMyanmarDateCompact,
  isFractionalUnit,
  parseMyanmarDateBoundary,
  roundQuantity,
} from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth();

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const status = searchParams.get('status');
    const paymentMethod = searchParams.get('paymentMethod');
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const where: Record<string, unknown> = {};

    // CASHIER can only see their own sales
    if (user.role === 'CASHIER') {
      where.userId = user.id;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        const start = parseMyanmarDateBoundary(startDate, false);
        if (!start) return NextResponse.json({ error: 'Invalid startDate' }, { status: 400 });
        (where.createdAt as Record<string, unknown>).gte = start;
      }
      if (endDate) {
        const end = parseMyanmarDateBoundary(endDate, true);
        if (!end) return NextResponse.json({ error: 'Invalid endDate' }, { status: 400 });
        (where.createdAt as Record<string, unknown>).lte = end;
      }
    }

    if (status) {
      where.status = status;
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
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

    return NextResponse.json({
      sales: serializePrismaData(sales),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch sales');
  }
}

const MAX_INVOICE_RETRIES = 3;

const saleResponseInclude = {
  items: { include: { product: { select: { name: true, nameMm: true, sku: true, unit: true } } } },
  payments: true,
  customer: { select: { id: true, name: true, phone: true, loyaltyPoints: true, creditBalance: true } },
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

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);

    // Auth: all authenticated users can create sales
    const user = await requireAuth();

    const body = await request.json();

    // Zod validation — only accept minimal trusted fields
    const parsed = createSaleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
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
    } = parsed.data;

    const cleanPaymentReference = paymentReference?.trim() || null;

    // Idempotency — return existing sale if same clientSaleId
    if (clientSaleId) {
      const existingSale = await findExistingSaleByClientSaleId(clientSaleId);
      if (existingSale) {
        return NextResponse.json(serializePrismaData(existingSale), { status: 200 });
      }
    }

    // Server-side recalculation with retries for invoice uniqueness
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_INVOICE_RETRIES; attempt++) {
      try {
        const sale = await prisma.$transaction(async (tx) => {
          // 1. Generate atomic invoice number in Myanmar timezone (UTC+6:30)
          const dateStr = getMyanmarDateCompact();

          const counter = await tx.invoiceCounter.upsert({
            where: { date: dateStr },
            create: { date: dateStr, counter: 1 },
            update: { counter: { increment: 1 } },
          });
          const invoiceNumber = `INV-${dateStr}-${counter.counter.toString().padStart(4, '0')}`;

          // 2. Fetch all products from DB (server-authoritative prices & units)
          const productIds = items.map((i) => i.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true, name: true, nameMm: true, sku: true, unit: true,
              sellingPrice: true, costPrice: true,
              stockQuantity: true, isActive: true,
            },
          });

          const productMap = new Map(products.map((p) => [p.id, p]));

          // 3. Fetch settings for tax rate & loyalty configuration
          const settings = await tx.settings.findUnique({
            where: { id: 'default' },
          });
          const taxRate = settings?.taxRate ?? 0;
          const loyaltyEnabled = settings?.loyaltyEnabled ?? true;
          const loyaltyEarnRate = Math.max(1, toNumber(settings?.loyaltyEarnRate ?? 1000));
          const loyaltyRedeemRate = Math.max(0, toNumber(settings?.loyaltyRedeemRate ?? 10));

          // 4. Validate customer if provided (or required by CREDIT / loyalty points)
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

          // 5. Validate items and compute server-side totals
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

          // 6. Compute cart discount, loyalty discount, tax, and grand total
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

          // 7. Normalize and validate payment legs (CASH, CARD, MOBILE_BANKING, CREDIT, SPLIT)
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
                throw new ApiError(
                  `Payment reference is required for ${leg.method} leg`,
                  400
                );
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
              normalizedLegs.push({ method: 'CREDIT', amount: dueAmount, reference: cleanPaymentReference });
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
            // CARD or MOBILE_BANKING
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

          // Calculate net cash entering the drawer
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

          // 8. Atomic stock update — prevent overselling
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

          // 9. Create the sale and payment legs
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

          // 10. Create StockMovement records per product using actual updated stock
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

          // 11. Update customer total purchases, credit balance, and loyalty points
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
        }, { maxWait: 10000, timeout: 15000 });

        return NextResponse.json(serializePrismaData(sale), { status: 201 });
      } catch (e: unknown) {
        // Retry on unique constraint violation (invoice number race)
        if (isUniqueConstraintError(e)) {
          if (clientSaleId) {
            const existingSale = await findExistingSaleByClientSaleId(clientSaleId);
            if (existingSale) {
              return NextResponse.json(serializePrismaData(existingSale), { status: 200 });
            }
          }
          lastError = e;
          continue;
        }
        throw e;
      }
    }

    // All retries exhausted
    console.error('Invoice generation failed after retries:', lastError);
    return NextResponse.json(
      { error: 'Failed to generate unique invoice number. Please try again.' },
      { status: 500 }
    );
  } catch (error) {
    return handleApiError(error, 'Failed to create sale');
  }
}
