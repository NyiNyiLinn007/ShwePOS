import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { updateSupplierSchema } from '@/lib/validations';
import { deactivateSupplier, updateSupplier } from '@/services/supplierService';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;

    const parsed = updateSupplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const updated = await updateSupplier(id, parsed.data);
    return NextResponse.json(updated);
  } catch (error) {
    return handleApiError(error, 'Failed to update supplier');
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    await validateCsrf(request);
    await requireRole('ADMIN');
    const { id } = await params;

    const updated = await deactivateSupplier(id);
    return NextResponse.json({ message: 'Supplier deactivated', supplier: updated });
  } catch (error) {
    return handleApiError(error, 'Failed to deactivate supplier');
  }
}
