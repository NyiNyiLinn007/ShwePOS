import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { ApiError, requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { updateUserSchema } from '@/lib/validations';
import { logAudit } from '@/services/auditService';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const adminUser = await requireRole('ADMIN');

    const { id } = await params;
    const body = await request.json();
    const parsed = updateUserSchema.parse(body);

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Prevent self-lockout (demoting or deactivating own admin account)
    if (id === adminUser.id) {
      if (parsed.isActive === false) {
        throw new ApiError('You cannot deactivate your own account', 400);
      }
      if (parsed.role !== undefined && parsed.role !== 'ADMIN') {
        throw new ApiError('You cannot remove your own ADMIN role', 400);
      }
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

    const nextRole = parsed.role ?? existing.role;
    const nextActive = parsed.isActive ?? existing.isActive;
    const demotingOrDeactivatingAdmin =
      existing.role === 'ADMIN' &&
      existing.isActive &&
      (nextRole !== 'ADMIN' || !nextActive);

    // Any credential/authorization change invalidates all JWTs immediately.
    if (
      (email !== undefined && email !== existing.email) ||
      (parsed.role !== undefined && parsed.role !== existing.role) ||
      (parsed.isActive !== undefined && parsed.isActive !== existing.isActive) ||
      (parsed.password && parsed.password.trim().length > 0)
    ) {
      updateData.sessionVersion = { increment: 1 };
    }

    const user = await prisma.$transaction(async (tx) => {
      if (demotingOrDeactivatingAdmin) {
        const remainingAdmins = await tx.user.count({
          where: { role: 'ADMIN', isActive: true, id: { not: id } },
        });
        if (remainingAdmins < 1) {
          throw new ApiError('Cannot deactivate or demote the last active ADMIN account', 409);
        }
      }

      const updated = await tx.user.update({
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

      await logAudit(
        {
          userId: adminUser.id,
          action: 'USER_UPDATED',
          entityType: 'USER',
          entityId: updated.id,
          summary: `Updated user ${updated.name} (Role: ${existing.role} -> ${updated.role}, Active: ${existing.isActive} -> ${updated.isActive})`,
          metadata: {
            targetUserId: updated.id,
            targetEmail: updated.email,
            oldRole: existing.role,
            newRole: updated.role,
            oldActive: existing.isActive,
            newActive: updated.isActive,
            passwordChanged: Boolean(parsed.password && parsed.password.trim().length > 0),
          },
        },
        tx
      );

      return updated;
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
    const adminUser = await requireRole('ADMIN');

    const { id } = await params;

    if (id === adminUser.id) {
      throw new ApiError('You cannot deactivate your own account', 400);
    }

    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      if (existing.role === 'ADMIN' && existing.isActive) {
        const remainingAdmins = await tx.user.count({
          where: { role: 'ADMIN', isActive: true, id: { not: id } },
        });
        if (remainingAdmins < 1) {
          throw new ApiError('Cannot deactivate the last active ADMIN account', 409);
        }
      }

      // Soft delete - deactivate user instead of hard delete
      await tx.user.update({
        where: { id },
        data: {
          isActive: false,
          sessionVersion: { increment: 1 },
        },
      });

      await logAudit(
        {
          userId: adminUser.id,
          action: 'USER_UPDATED',
          entityType: 'USER',
          entityId: existing.id,
          summary: `Deactivated user ${existing.name} (${existing.email})`,
          metadata: { targetUserId: existing.id, deactivated: true },
        },
        tx
      );
    });

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully',
    });
  } catch (error) {
    return handleApiError(error, 'Failed to deactivate user');
  }
}
