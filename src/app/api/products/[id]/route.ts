import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateProductSchema } from '@/lib/validations';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { serializePrismaData, toNumber } from '@/lib/number';
import { parseMyanmarDateBoundary } from '@/lib/utils';
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
      select: { id: true, name: true, barcode: true, costPrice: true, sellingPrice: true },
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

    const normalizedBarcode =
      parsed.data.barcode !== undefined ? parsed.data.barcode?.trim() || null : undefined;
    const effectiveMainBarcode =
      normalizedBarcode !== undefined ? normalizedBarcode : existing.barcode;

    const cleanUnits =
      parsed.data.productUnits !== undefined
        ? parsed.data.productUnits
            .filter((u) => u.unitName.trim().length > 0 && u.conversionFactor > 0)
            .map((u) => ({
              id: u.id,
              unitName: u.unitName.trim(),
              nameMm: u.nameMm?.trim() || null,
              conversionFactor: u.conversionFactor,
              sellingPrice: u.sellingPrice,
              barcode: u.barcode?.trim() || null,
            }))
        : undefined;

    // Validate duplicate unit names and cross-table barcodes (Product.barcode + ProductUnit.barcode)
    const payloadBarcodes = new Set<string>();
    if (effectiveMainBarcode) payloadBarcodes.add(effectiveMainBarcode);
    if (cleanUnits) {
      const unitNamesSeen = new Set<string>();
      for (const u of cleanUnits) {
        const lowerName = u.unitName.toLowerCase();
        if (unitNamesSeen.has(lowerName)) {
          return NextResponse.json(
            { error: `Duplicate packaging unit name: '${u.unitName}'` },
            { status: 409 }
          );
        }
        unitNamesSeen.add(lowerName);
        if (u.barcode) {
          if (payloadBarcodes.has(u.barcode)) {
            return NextResponse.json(
              { error: `Duplicate barcode '${u.barcode}' within product and packaging units` },
              { status: 409 }
            );
          }
          payloadBarcodes.add(u.barcode);
        }
      }
    }

    if (payloadBarcodes.size > 0) {
      const barcodeList = Array.from(payloadBarcodes);
      const [dupProd, dupUnit] = await Promise.all([
        prisma.product.findFirst({
          where: { barcode: { in: barcodeList }, id: { not: id } },
          select: { barcode: true },
        }),
        prisma.productUnit.findFirst({
          where: { barcode: { in: barcodeList }, productId: { not: id } },
          select: { barcode: true },
        }),
      ]);
      if (dupProd || dupUnit) {
        return NextResponse.json(
          {
            error: `Barcode '${dupProd?.barcode || dupUnit?.barcode}' is already in use by another product or packaging unit`,
          },
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

    const { productUnits: _ignoredUnits, ...restData } = parsed.data;
    const updateData: Record<string, unknown> = { ...restData };
    if (normalizedBarcode !== undefined) {
      updateData.barcode = normalizedBarcode;
    }
    if (parsed.data.expiryDate !== undefined) {
      updateData.expiryDate = parsed.data.expiryDate
        ? (parseMyanmarDateBoundary(parsed.data.expiryDate, true) ?? new Date(parsed.data.expiryDate))
        : null;
    }

    const product = await prisma.$transaction(async (tx) => {
      if (cleanUnits !== undefined) {
        // Diff & upsert ProductUnit rows in place so existing IDs stay valid for active POS carts, Held Bills & Offline Queue
        const existingUnits = await tx.productUnit.findMany({
          where: { productId: id },
          select: { id: true, unitName: true },
        });
        const existingById = new Map(existingUnits.map((u) => [u.id, u]));
        const existingByName = new Map(existingUnits.map((u) => [u.unitName.toLowerCase(), u]));
        const keptIds = new Set<string>();

        // First clear barcodes on removed units to avoid transient unique collisions when reassigning barcodes
        const incomingResolved = cleanUnits.map((u) => {
          const matched =
            (u.id && existingById.get(u.id)) || existingByName.get(u.unitName.toLowerCase()) || null;
          if (matched) keptIds.add(matched.id);
          return { ...u, existingId: matched?.id ?? null };
        });

        const idsToDelete = existingUnits.map((u) => u.id).filter((uid) => !keptIds.has(uid));
        if (idsToDelete.length > 0) {
          await tx.productUnit.deleteMany({ where: { id: { in: idsToDelete } } });
        }

        // Clear existing barcodes temporarily if swapping barcodes between two units of the same product
        if (keptIds.size > 1) {
          await tx.productUnit.updateMany({
            where: { id: { in: Array.from(keptIds) } },
            data: { barcode: null },
          });
        }

        for (const u of incomingResolved) {
          if (u.existingId) {
            await tx.productUnit.update({
              where: { id: u.existingId },
              data: {
                unitName: u.unitName,
                nameMm: u.nameMm,
                conversionFactor: u.conversionFactor,
                sellingPrice: u.sellingPrice,
                barcode: u.barcode,
              },
            });
          } else {
            await tx.productUnit.create({
              data: {
                productId: id,
                unitName: u.unitName,
                nameMm: u.nameMm,
                conversionFactor: u.conversionFactor,
                sellingPrice: u.sellingPrice,
                barcode: u.barcode,
              },
            });
          }
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
    await requireRole('ADMIN');

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
