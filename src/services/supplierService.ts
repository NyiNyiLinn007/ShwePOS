import prisma from '@/lib/prisma';
import { ApiError, AuthUser } from '@/lib/apiAuth';
import {
  CreateSupplierInput,
  UpdateSupplierInput,
  RepaySupplierDebtInput,
} from '@/lib/validations';
import { roundMoney, serializePrismaData, toNumber } from '@/lib/number';
import { logAudit } from '@/services/auditService';

export async function listSuppliers(search?: string | null, includeInactive = false) {
  const where: Record<string, unknown> = {};
  if (!includeInactive) {
    where.isActive = true;
  }
  if (search && search.trim()) {
    const q = search.trim();
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { contactPerson: { contains: q, mode: 'insensitive' } },
      { phone: { contains: q, mode: 'insensitive' } },
    ];
  }

  const suppliers = await prisma.supplier.findMany({
    where,
    include: {
      purchaseOrders: {
        where: { status: 'RECEIVED' },
        select: {
          id: true,
          poNumber: true,
          totalAmount: true,
          dueAmount: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      payments: {
        include: {
          user: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
      _count: {
        select: { purchaseOrders: true },
      },
    },
    orderBy: { createdAt: 'desc' },
  });

  const formatted = suppliers.map((s) => {
    const totalPurchased = s.purchaseOrders.reduce(
      (sum, po) => roundMoney(sum + toNumber(po.totalAmount)),
      0
    );
    return {
      ...s,
      creditBalance: toNumber(s.creditBalance),
      purchaseOrderCount: s._count.purchaseOrders,
      totalPurchased,
    };
  });

  return serializePrismaData(formatted);
}

export async function createSupplier(input: CreateSupplierInput) {
  const supplier = await prisma.supplier.create({
    data: {
      name: input.name.trim(),
      contactPerson: input.contactPerson?.trim() || null,
      phone: input.phone?.trim() || null,
      email: input.email?.trim() || null,
      address: input.address?.trim() || null,
      notes: input.notes?.trim() || null,
      isActive: input.isActive ?? true,
    },
  });

  return serializePrismaData({
    ...supplier,
    creditBalance: toNumber(supplier.creditBalance),
    purchaseOrderCount: 0,
    totalPurchased: 0,
    purchaseOrders: [],
    payments: [],
  });
}

export async function updateSupplier(id: string, input: UpdateSupplierInput) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError('Supplier not found', 404);
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.contactPerson !== undefined && {
        contactPerson: input.contactPerson?.trim() || null,
      }),
      ...(input.phone !== undefined && { phone: input.phone?.trim() || null }),
      ...(input.email !== undefined && { email: input.email?.trim() || null }),
      ...(input.address !== undefined && { address: input.address?.trim() || null }),
      ...(input.notes !== undefined && { notes: input.notes?.trim() || null }),
      ...(input.isActive !== undefined && { isActive: input.isActive }),
    },
  });

  return serializePrismaData(updated);
}

export async function deactivateSupplier(id: string) {
  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    throw new ApiError('Supplier not found', 404);
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: { isActive: false },
  });

  return serializePrismaData(updated);
}

export async function repaySupplierDebt(
  id: string,
  input: RepaySupplierDebtInput,
  user: AuthUser
) {
  const amount = roundMoney(input.amount);
  const cleanRef = input.reference?.trim() || null;

  if (input.method !== 'CASH' && !cleanRef) {
    throw new ApiError('Payment reference is required for non-cash supplier payments', 400);
  }

  const result = await prisma.$transaction(async (tx) => {
    const supplier = await tx.supplier.findUnique({
      where: { id },
      select: { id: true, name: true, creditBalance: true },
    });

    if (!supplier) {
      throw new ApiError('Supplier not found', 404);
    }

    const currentPayable = roundMoney(toNumber(supplier.creditBalance));
    if (currentPayable <= 0) {
      throw new ApiError('No outstanding payable balance for this supplier', 400);
    }
    if (amount > currentPayable) {
      throw new ApiError(
        `Payment amount (${amount}) cannot exceed payable balance (${currentPayable})`,
        400
      );
    }

    // Optional cash drawer PAID_OUT if paying supplier from an active register
    if (input.method === 'CASH') {
      const openShift =
        (await tx.shift.findFirst({
          where: { userId: user.id, status: 'OPEN' },
          select: { id: true },
          orderBy: { openedAt: 'desc' },
        })) ??
        (await tx.shift.findFirst({
          where: { status: 'OPEN' },
          select: { id: true },
          orderBy: { openedAt: 'desc' },
        }));

      if (openShift) {
        await tx.cashDrawerMovement.create({
          data: {
            shiftId: openShift.id,
            userId: user.id,
            type: 'PAID_OUT',
            amount: -amount,
            reason: `Supplier payment to ${supplier.name}${input.notes ? `: ${input.notes}` : ''}`,
          },
        });
      }
    }

    const payment = await tx.supplierPayment.create({
      data: {
        supplierId: supplier.id,
        userId: user.id,
        amount,
        method: input.method,
        reference: cleanRef,
        notes: input.notes?.trim() || null,
      },
      include: {
        user: { select: { id: true, name: true } },
      },
    });

    const updatedSupplier = await tx.supplier.update({
      where: { id: supplier.id },
      data: {
        creditBalance: { decrement: amount },
      },
    });

    const newCreditBalance = roundMoney(toNumber(updatedSupplier.creditBalance));

    await logAudit(
      {
        userId: user.id,
        action: 'SUPPLIER_DEBT_REPAYMENT',
        entityType: 'SUPPLIER',
        entityId: supplier.id,
        summary: `Paid ${amount} K (${input.method}) to supplier ${supplier.name} (Remaining payable: ${newCreditBalance} K)`,
        metadata: {
          supplierName: supplier.name,
          previousBalance: currentPayable,
          paidAmount: amount,
          newCreditBalance,
          method: input.method,
          reference: cleanRef,
        },
      },
      tx
    );

    return {
      supplier: updatedSupplier,
      payment,
      previousBalance: currentPayable,
      paidAmount: amount,
      newCreditBalance,
    };
  });

  return serializePrismaData(result);
}
