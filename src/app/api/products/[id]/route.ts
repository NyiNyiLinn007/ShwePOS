import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateProductSchema } from '@/lib/validations';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { serializePrismaData, toNumber } from '@/lib/number';
import { logAudit } from '@/services/auditService';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameMm: true,
          },
        },
        productUnits: {
          orderBy: { conversionFactor: 'asc' },
        },
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(serializePrismaData(product));
  } catch (error) {
    return handleApiError(error, 'Failed to fetch product');
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const existing = await prisma.product.findUnique({
      where: { id },
      select: { id: true, name: true, costPrice: true, sellingPrice: true },
    });
    if (!existing) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Check SKU uniqueness if being updated
    if (parsed.data.sku) {
      const existingSku = await prisma.product.findFirst({
        where: {
          sku: parsed.data.sku,
          id: { not: id },
        },
      });

      if (existingSku) {
        return NextResponse.json(
          { error: 'A product with this SKU already exists' },
          { status: 409 }
        );
      }
    }

    // Check barcode uniqueness if being updated
    if (parsed.data.barcode) {
      const existingBarcode = await prisma.product.findFirst({
        where: {
          barcode: parsed.data.barcode,
          id: { not: id },
        },
      });

      if (existingBarcode) {
        return NextResponse.json(
          { error: 'A product with this barcode already exists' },
          { status: 409 }
        );
      }
    }

    // Verify category if being updated
    if (parsed.data.categoryId) {
      const category = await prisma.category.findUnique({
        where: { id: parsed.data.categoryId },
      });

      if (!category) {
        return NextResponse.json(
          { error: 'Selected category does not exist' },
          { status: 400 }
        );
      }
    }

    const { productUnits, ...restData } = parsed.data;
    const updateData: Record<string, unknown> = { ...restData };
    if (parsed.data.expiryDate !== undefined) {
      updateData.expiryDate = parsed.data.expiryDate ? new Date(parsed.data.expiryDate) : null;
    }

    const product = await prisma.$transaction(async (tx) => {
      if (productUnits !== undefined) {
        await tx.productUnit.deleteMany({ where: { productId: id } });
        const cleanUnits = productUnits
          .filter((u) => u.unitName.trim().length > 0 && u.conversionFactor > 0)
          .map((u) => ({
            productId: id,
            unitName: u.unitName.trim(),
            nameMm: u.nameMm?.trim() || null,
            conversionFactor: u.conversionFactor,
            sellingPrice: u.sellingPrice,
            barcode: u.barcode?.trim() || null,
          }));
        if (cleanUnits.length > 0) {
          await tx.productUnit.createMany({ data: cleanUnits });
        }
      }

      const updated = await tx.product.update({
        where: { id },
        data: updateData,
        include: {
          category: {
            select: {
              id: true,
              name: true,
              nameMm: true,
            },
          },
          productUnits: {
            orderBy: { conversionFactor: 'asc' },
          },
        },
      });

      const oldCost = toNumber(existing.costPrice);
      const oldSell = toNumber(existing.sellingPrice);
      const newCost = toNumber(updated.costPrice);
      const newSell = toNumber(updated.sellingPrice);
      if (oldCost !== newCost || oldSell !== newSell) {
        await logAudit(
          {
            userId: user.id,
            action: 'PRODUCT_PRICE_CHANGE',
            entityType: 'PRODUCT',
            entityId: id,
            summary: `Updated pricing for ${updated.name} (Cost: ${oldCost} -> ${newCost} K, Selling: ${oldSell} -> ${newSell} K)`,
            metadata: {
              productName: updated.name,
              oldCost,
              newCost,
              oldSell,
              newSell,
            },
          },
          tx
        );
      }

      return updated;
    });

    return NextResponse.json(serializePrismaData(product));
  } catch (error) {
    return handleApiError(error, 'Failed to update product');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;

    // Soft delete by setting isActive to false
    const product = await prisma.product.update({
      where: { id },
      data: { isActive: false },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameMm: true,
          },
        },
        productUnits: {
          orderBy: { conversionFactor: 'asc' },
        },
      },
    });

    return NextResponse.json({
      message: 'Product deactivated successfully',
      product: serializePrismaData(product),
    });
  } catch (error) {
    return handleApiError(error, 'Failed to delete product');
  }
}
