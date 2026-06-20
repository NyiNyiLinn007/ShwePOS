import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, requireRole, handleApiError, ApiError } from '@/lib/apiAuth';
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

export async function POST(request: NextRequest) {
  try {
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
    const { items, customerId, paymentMethod, paidAmount, cartDiscount, clientSaleId, notes } = parsed.data;

    // Fix 6: CREDIT sales not yet supported
    if (paymentMethod === 'CREDIT') {
      return NextResponse.json(
        { error: 'Credit sales are not yet supported' },
        { status: 400 }
      );
    }

    // Fix 5: Idempotency — return existing sale if same clientSaleId
    if (clientSaleId) {
      const existingSale = await prisma.sale.findUnique({
        where: { clientSaleId },
        include: {
          items: { include: { product: { select: { name: true, nameMm: true, sku: true } } } },
          customer: { select: { id: true, name: true, phone: true } },
          user: { select: { id: true, name: true } },
        },
      });
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
          }

          // 5. Compute tax and grand total (Fix 1: include cartDiscount)
          const totalItemDiscount = totalDiscount;
          const effectiveDiscount = totalItemDiscount + (cartDiscount || 0);
          const discountedSubtotal = Math.max(0, subtotal - effectiveDiscount);
          const taxAmount = Math.round(discountedSubtotal * taxRate) / 100;
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
          for (const saleItem of saleItemsData) {
            const result = await tx.product.updateMany({
              where: {
                id: saleItem.productId,
                stockQuantity: { gte: saleItem.quantity },
              },
              data: {
                stockQuantity: { decrement: saleItem.quantity },
              },
            });
            if (result.count === 0) {
              const product = productMap.get(saleItem.productId)!;
              throw new ApiError(
                `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`,
                409
              );
            }
          }

          // 9. Create the sale
          const newSale = await tx.sale.create({
            data: {
              invoiceNumber,
              clientSaleId: clientSaleId || null,
              customerId: customerId || null,
              userId: user.id,
              subtotal: discountedSubtotal,
              discountAmount: effectiveDiscount,
              taxAmount,
              totalAmount,
              paidAmount: finalPaid,
              changeAmount,
              paymentMethod,
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
          });

          // 10. Create StockMovement records for each item (Fix 2: use saleItem.quantity)
          for (const saleItem of saleItemsData) {
            const product = productMap.get(saleItem.productId)!;
            await tx.stockMovement.create({
              data: {
                productId: saleItem.productId,
                userId: user.id,
                saleId: newSale.id,
                quantity: saleItem.quantity,
                type: 'OUT',
                reason: `Sale: ${invoiceNumber}`,
                previousStock: product.stockQuantity,
                newStock: product.stockQuantity - saleItem.quantity,
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

          return newSale;
        }, { maxWait: 10000, timeout: 15000 });

        return NextResponse.json(sale, { status: 201 });
      } catch (e: unknown) {
        // Retry on unique constraint violation (invoice number race)
        if (
          e &&
          typeof e === 'object' &&
          'code' in e &&
          (e as { code: string }).code === 'P2002'
        ) {
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
