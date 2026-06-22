import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { createCategorySchema } from '@/lib/validations';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get('search') || '';
    const includeInactive = searchParams.get('includeInactive') === 'true';

    const where: Record<string, unknown> = {};

    if (!includeInactive) {
      where.isActive = true;
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { nameMm: { contains: search } },
      ];
    }

    const categories = await prisma.category.findMany({
      where,
      include: {
        _count: {
          select: { products: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(categories);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch categories');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');

    const body = await request.json();
    const parsed = createCategorySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    // Check for duplicate slug
    const existing = await prisma.category.findUnique({
      where: { slug: parsed.data.slug },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'A category with this slug already exists' },
        { status: 409 }
      );
    }

    const category = await prisma.category.create({
      data: {
        name: parsed.data.name,
        nameMm: parsed.data.nameMm ?? null,
        description: parsed.data.description ?? null,
        slug: parsed.data.slug,
        isActive: parsed.data.isActive ?? true,
      },
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return NextResponse.json(category, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create category');
  }
}
