import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { createUserSchema } from '@/lib/validations';
import { logAudit } from '@/services/auditService';

export async function GET() {
  try {
    await requireRole('ADMIN');

    const users = await prisma.user.findMany({
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
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(users);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch users');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const operator = await requireRole('ADMIN');

    const body = await request.json();
    const parsed = createUserSchema.parse(body);
    const { name, password, role, phone, isActive } = parsed;
    const email = parsed.email.toLowerCase().trim();

    // Check for duplicate email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });
    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 409 }
      );
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: role || 'CASHIER',
        phone: phone || null,
        isActive: isActive !== undefined ? isActive : true,
      },
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

    await logAudit({
      userId: operator.id,
      action: 'USER_CREATED',
      entityType: 'USER',
      entityId: user.id,
      summary: `Created user ${user.name} (${user.email}) with role ${user.role}`,
      metadata: {
        email: user.email,
        role: user.role,
        isActive: user.isActive,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create user');
  }
}
