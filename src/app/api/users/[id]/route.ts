import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { updateUserSchema } from '@/lib/validations';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    await requireRole('ADMIN');

    const { id } = await params;
    const body = await request.json();
    const parsed = updateUserSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Normalize email if provided
    const email = parsed.email ? parsed.email.toLowerCase().trim() : undefined;

    // If email changed, check for duplicates
    if (email && email !== existing.email) {
      const emailTaken = await prisma.user.findUnique({ where: { email } });
      if (emailTaken) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 409 }
        );
      }
    }

    // Build update data
    const updateData: Record<string, unknown> = {};
    if (parsed.name !== undefined) updateData.name = parsed.name;
    if (email !== undefined) updateData.email = email;
    if (parsed.role !== undefined) updateData.role = parsed.role;
    if (parsed.phone !== undefined) updateData.phone = parsed.phone || null;
    if (parsed.isActive !== undefined) updateData.isActive = parsed.isActive;

    // Hash new password if provided
    if (parsed.password && parsed.password.trim().length > 0) {
      updateData.password = await bcrypt.hash(parsed.password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        phone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(user);
  } catch (error) {
    return handleApiError(error, 'Failed to update user');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    await requireRole('ADMIN');

    const { id } = await params;

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Soft delete - deactivate user instead of hard delete
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    });

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    return handleApiError(error, 'Failed to deactivate user');
  }
}
