import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, handleApiError, ApiError, validateCsrf } from '@/lib/apiAuth';
import { createSaleSchema } from '@/lib/validations';

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
        (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
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
                select: { name: true, nameMm: true, sku: true },
              },
            },
          },
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
      sales,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch sales');
  }
}

const MAX_INVOICE_RETRIES = 3;

const saleResponseInclude = {
  items: { include: { product: { select: { name: true, nameMm: true, sku: true } } } },
  customer: { select: { id: true, name: true, phone: true } },
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
      cartDiscount,
      clientSaleId,
      paymentReference,
      notes,
    } = parsed.data;

    // Fix 6: CREDIT sales not yet supported
    if (paymentMethod === 'CREDIT') {
      return NextResponse.json(
        { error: 'Credit sales are not yet supported' },
        { status: 400 }
      );
    }

    const cleanPaymentReference = paymentReference?.trim() || null;
    if (paymentMethod !== 'CASH' && !cleanPaymentReference) {
      return NextResponse.json(
        { error: 'Payment reference is required for non-cash payments' },
        { status: 400 }
      );
    }

    // Fix 5: Idempotency — return existing sale if same clientSaleId
    if (clientSaleId) {
      const existingSale = await findExistingSaleByClientSaleId(clientSaleId);
      if (existingSale) {
        return NextResponse.json(existingSale, { status: 200 });
      }
    }

    // Server-side recalculation with retries for invoice uniqueness
    let lastError: unknown = null;
    for (let attempt = 0; attempt < MAX_INVOICE_RETRIES; attempt++) {
      try {
        const sale = await prisma.$transaction(async (tx) => {
          // 1. Generate atomic invoice number
          const today = new Date();
          const dateStr =
            today.getFullYear().toString() +
            (today.getMonth() + 1).toString().padStart(2, '0') +
            today.getDate().toString().padStart(2, '0');

          const counter = await tx.invoiceCounter.upsert({
            where: { date: dateStr },
            create: { date: dateStr, counter: 1 },
            update: { counter: { increment: 1 } },
          });
          const invoiceNumber = `INV-${dateStr}-${counter.counter.toString().padStart(4, '0')}`;

          // 2. Fetch all products from DB (server-authoritative prices)
          const productIds = items.map((i) => i.productId);
          const products = await tx.product.findMany({
            where: { id: { in: productIds } },
            select: {
              id: true, name: true, nameMm: true, sku: true,
              sellingPrice: true, costPrice: true,
              stockQuantity: true, isActive: true,
            },
          });

          const productMap = new Map(products.map((p) => [p.id, p]));

          // 3. Fetch settings for tax rate
          const settings = await tx.settings.findUnique({
            where: { id: 'default' },
            select: { taxRate: true },
          });
          const taxRate = settings?.taxRate ?? 0;

          // 4. Validate items and compute server-side totals
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

            const itemSubtotal = product.sellingPrice * item.quantity;
            const itemDiscount = Math.min(item.discount || 0, itemSubtotal); // Cap discount at item total
            if (itemDiscount < 0) {
              throw new ApiError('Discount cannot be negative', 400);
            }
            const itemTotal = itemSubtotal - itemDiscount;

            subtotal += itemSubtotal;
            totalDiscount += itemDiscount;

            saleItemsData.push({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: product.sellingPrice,
              costPrice: product.costPrice,
              discount: itemDiscount,
              total: itemTotal,
            });
            stockDeductions.set(
              item.productId,
              (stockDeductions.get(item.productId) ?? 0) + item.quantity
            );
          }

          // 5. Compute tax and grand total (Fix 1: include cartDiscount)
          const totalItemDiscount = totalDiscount;
          const maxCartDiscount = Math.max(0, subtotal - totalItemDiscount);
          const cartDiscountAmount = Math.min(cartDiscount || 0, maxCartDiscount);
          const effectiveDiscount = totalItemDiscount + cartDiscountAmount;
          const discountedSubtotal = Math.max(0, subtotal - effectiveDiscount);
          const taxAmount = Math.round(discountedSubtotal * (taxRate / 100));
          const totalAmount = discountedSubtotal + taxAmount;

          // 6. Validate payment
          let finalPaid = paidAmount;
          let changeAmount = 0;

          if (paymentMethod === 'CASH') {
            if (paidAmount < totalAmount) {
              throw new ApiError(
                `Insufficient payment. Total: ${totalAmount}, Paid: ${paidAmount}`,
                400
              );
            }
            changeAmount = paidAmount - totalAmount;
          } else {
            // Non-cash: paid = total, no change
            finalPaid = totalAmount;
            changeAmount = 0;
          }

          // 7. Validate customer if provided
          if (customerId) {
            const customer = await tx.customer.findUnique({
              where: { id: customerId },
              select: { id: true },
            });
            if (!customer) {
              throw new ApiError('Customer not found', 400);
            }
          }

          // 8. Atomic stock update — prevent overselling (Fix 2: use saleItemsData directly)
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
                await tx.product.findUnique({
                  where: { id: productId },
                  select: { name: true, stockQuantity: true },
                }) ?? productMap.get(productId);
              throw new ApiError(
                `Insufficient stock for ${currentProduct?.name ?? 'product'}. Available: ${currentProduct?.stockQuantity ?? 0}`,
                409
              );
            }

            const updatedProduct = await tx.product.findUnique({
              where: { id: productId },
              select: { stockQuantity: true },
            });
            const newStock = updatedProduct?.stockQuantity ?? 0;
            stockMovementsData.push({
              productId,
              quantity,
              previousStock: newStock + quantity,
              newStock,
            });
          }

          // 9. Create the sale
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
              changeAmount,
              paymentMethod,
              paymentStatus: 'PAID',
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
            },
            include: saleResponseInclude,
          });

          // 10. Create StockMovement records per product using actual updated stock.
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

          // 11. Update customer total purchases
          if (customerId) {
            await tx.customer.update({
              where: { id: customerId },
              data: {
                totalPurchases: { increment: totalAmount },
              },
            });
          }

          if (paymentMethod === 'CASH') {
            const openShift = await tx.shift.findFirst({
              where: { userId: user.id, status: 'OPEN' },
              select: { id: true },
              orderBy: { openedAt: 'desc' },
            });

            await tx.cashDrawerMovement.create({
              data: {
                shiftId: openShift?.id ?? null,
                saleId: newSale.id,
                userId: user.id,
                type: 'CASH_SALE',
                amount: totalAmount,
                reason: `Sale: ${invoiceNumber}`,
              },
            });
          }

          return newSale;
        }, { maxWait: 10000, timeout: 15000 });

        return NextResponse.json(sale, { status: 201 });
      } catch (e: unknown) {
        // Retry on unique constraint violation (invoice number race)
        if (isUniqueConstraintError(e)) {
          if (clientSaleId) {
            const existingSale = await findExistingSaleByClientSaleId(clientSaleId);
            if (existingSale) {
              return NextResponse.json(existingSale, { status: 200 });
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
