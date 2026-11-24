import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createProductSchema } from '@/lib/validations';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { serializePrismaData } from '@/lib/number';
import { isFractionalUnit, parseMyanmarDateBoundary } from '@/lib/utils';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const categoryId = searchParams.get('categoryId') || '';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { nameMm: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search, mode: 'insensitive' } },
      ];
    }

    const products = await prisma.product.findMany({
      where,
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(serializePrismaData(products));
  } catch (error) {
    return handleApiError(error, 'Failed to fetch products');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');

    const body = await request.json();
    const parsed = createProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check for duplicate SKU
    const existingSku = await prisma.product.findUnique({
      where: { sku: parsed.data.sku },
    });

    if (existingSku) {
      return NextResponse.json(
        { error: 'A product with this SKU already exists' },
        { status: 409 }
      );
    }

    const normalizedBarcode = parsed.data.barcode?.trim() || null;

    // Validate integer stock for non-fractional units
    if (!isFractionalUnit(parsed.data.unit) && !Number.isInteger(parsed.data.stockQuantity)) {
      return NextResponse.json(
        { error: `Fractional stock quantity is not allowed for unit '${parsed.data.unit}'` },
        { status: 400 }
      );
    }

    const cleanUnits = (parsed.data.productUnits ?? [])
      .filter((u) => u.unitName.trim().length > 0 && u.conversionFactor > 0)
      .map((u) => ({
        unitName: u.unitName.trim(),
        nameMm: u.nameMm?.trim() || null,
        conversionFactor: u.conversionFactor,
        sellingPrice: u.sellingPrice,
        barcode: u.barcode?.trim() || null,
      }));

    // Check duplicate unitName or barcode inside payload
    const unitNamesSeen = new Set<string>();
    const payloadBarcodes = new Set<string>();
    if (normalizedBarcode) payloadBarcodes.add(normalizedBarcode);
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

    // Check cross-table barcode uniqueness across Product.barcode AND ProductUnit.barcode
    if (payloadBarcodes.size > 0) {
      const barcodeList = Array.from(payloadBarcodes);
      const [dupProd, dupUnit] = await Promise.all([
        prisma.product.findFirst({
          where: { barcode: { in: barcodeList } },
          select: { barcode: true },
        }),
        prisma.productUnit.findFirst({
          where: { barcode: { in: barcodeList } },
          select: { barcode: true },
        }),
      ]);
      if (dupProd || dupUnit) {
        return NextResponse.json(
          { error: `Barcode '${dupProd?.barcode || dupUnit?.barcode}' is already in use by another product or packaging unit` },
          { status: 409 }
        );
      }
    }

    // Verify category exists
    const category = await prisma.category.findUnique({
      where: { id: parsed.data.categoryId },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Selected category does not exist' },
        { status: 400 }
      );
    }

    const parsedExpiry = parsed.data.expiryDate
      ? (parseMyanmarDateBoundary(parsed.data.expiryDate, true) ?? new Date(parsed.data.expiryDate))
      : null;

    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: {
          name: parsed.data.name,
          nameMm: parsed.data.nameMm ?? null,
          sku: parsed.data.sku,
          barcode: normalizedBarcode,
          categoryId: parsed.data.categoryId,
          costPrice: parsed.data.costPrice,
          sellingPrice: parsed.data.sellingPrice,
          stockQuantity: parsed.data.stockQuantity,
          lowStockThreshold: parsed.data.lowStockThreshold,
          unit: parsed.data.unit,
          imageUrl: parsed.data.imageUrl ?? null,
          batchNumber: parsed.data.batchNumber ?? null,
          expiryDate: parsedExpiry,
          isActive: parsed.data.isActive ?? true,
          ...(cleanUnits.length > 0
            ? {
                productUnits: {
                  create: cleanUnits,
                },
              }
            : {}),
        },
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

      if (parsed.data.stockQuantity > 0) {
        await tx.stockMovement.create({
          data: {
            productId: created.id,
            userId: user.id,
            quantity: parsed.data.stockQuantity,
            type: 'IN',
            reason: 'Initial stock on product creation',
            previousStock: 0,
            newStock: parsed.data.stockQuantity,
          },
        });
      }

      return created;
    });

    return NextResponse.json(serializePrismaData(product), { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create product');
  }
}
