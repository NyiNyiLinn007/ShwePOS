import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createProductSchema } from '@/lib/validations';

export async function GET(request: NextRequest) {
  try {
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
        { name: { contains: search } },
        { nameMm: { contains: search } },
        { sku: { contains: search } },
        { barcode: { contains: search } },
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
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(products);
  } catch (error) {
    console.error('Failed to fetch products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
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

    // Check for duplicate barcode if provided
    if (parsed.data.barcode) {
      const existingBarcode = await prisma.product.findUnique({
        where: { barcode: parsed.data.barcode },
      });

      if (existingBarcode) {
        return NextResponse.json(
          { error: 'A product with this barcode already exists' },
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

    const product = await prisma.product.create({
      data: {
        name: parsed.data.name,
        nameMm: parsed.data.nameMm ?? null,
        sku: parsed.data.sku,
        barcode: parsed.data.barcode ?? null,
        categoryId: parsed.data.categoryId,
        costPrice: parsed.data.costPrice,
        sellingPrice: parsed.data.sellingPrice,
        stockQuantity: parsed.data.stockQuantity,
        lowStockThreshold: parsed.data.lowStockThreshold,
        unit: parsed.data.unit,
        imageUrl: parsed.data.imageUrl ?? null,
        isActive: parsed.data.isActive ?? true,
      },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            nameMm: true,
          },
        },
      },
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    console.error('Failed to create product:', error);
    return NextResponse.json(
      { error: 'Failed to create product' },
      { status: 500 }
    );
  }
}
