import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { repaySupplierDebtSchema } from '@/lib/validations';
import { repaySupplierDebt } from '@/services/supplierService';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await validateCsrf(request);
    const user = await requireRole('MANAGER', 'ADMIN');
    const { id } = await params;

    const parsed = repaySupplierDebtSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const result = await repaySupplierDebt(id, parsed.data, user);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to record supplier payment');
  }
}
