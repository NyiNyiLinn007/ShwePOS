import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { updateCategorySchema } from '@/lib/validations';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const category = await prisma.category.findUnique({
      where: { id },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    if (!category) {
      return NextResponse.json(
        { error: 'Category not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(category);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch category');
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;
    const body = await request.json();
    const parsed = updateCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // If slug is being updated, check for duplicates
    if (parsed.data.slug) {
      const existing = await prisma.category.findFirst({
        where: {
          slug: parsed.data.slug,
          id: { not: id },
        },
      });

      if (existing) {
        return NextResponse.json(
          { error: 'A category with this slug already exists' },
          { status: 409 }
        );
      }
    }

    const category = await prisma.category.update({
      where: { id },
      data: parsed.data,
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return NextResponse.json(category);
  } catch (error) {
    return handleApiError(error, 'Failed to update category');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');

    const { id } = await params;

    // Check if there are products using this category
    const productCount = await prisma.product.count({
      where: { categoryId: id },
    });

    if (productCount > 0) {
      return NextResponse.json(
        { error: `Cannot delete category: ${productCount} product(s) are using this category. Reassign them first.` },
        { status: 409 }
      );
    }

    await prisma.category.delete({
      where: { id },
    });

    return NextResponse.json({ message: 'Category deleted successfully' });
  } catch (error) {
    return handleApiError(error, 'Failed to delete category');
  }
}
