import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateProductSchema } from '@/lib/validations';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
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
      },
    });

    if (!product) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Failed to fetch product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const body = await request.json();
    const parsed = updateProductSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
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

    const product = await prisma.product.update({
      where: { id },
      data: parsed.data,
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

    return NextResponse.json(product);
  } catch (error) {
    console.error('Failed to update product:', error);
    return NextResponse.json(
      { error: 'Failed to update product' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
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
      },
    });

    return NextResponse.json({
      message: 'Product deactivated successfully',
      product,
    });
  } catch (error) {
    console.error('Failed to delete product:', error);
    return NextResponse.json(
      { error: 'Failed to delete product' },
      { status: 500 }
    );
  }
}
