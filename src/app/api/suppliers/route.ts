import { NextRequest, NextResponse } from 'next/server';
import { requireRole, handleApiError, validateCsrf } from '@/lib/apiAuth';
import { createSupplierSchema } from '@/lib/validations';
import { createSupplier, listSuppliers } from '@/services/supplierService';

export async function GET(request: NextRequest) {
  try {
    await requireRole('MANAGER', 'ADMIN');
    const search = request.nextUrl.searchParams.get('search');
    const includeInactive = request.nextUrl.searchParams.get('includeInactive') === 'true';
    const suppliers = await listSuppliers(search, includeInactive);
    return NextResponse.json(suppliers);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch suppliers');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    await requireRole('MANAGER', 'ADMIN');
    const parsed = createSupplierSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const supplier = await createSupplier(parsed.data);
    return NextResponse.json(supplier, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create supplier');
  }
}
