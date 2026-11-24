import { NextRequest, NextResponse } from 'next/server';
import { handleApiError, requireAuth, validateCsrf } from '@/lib/apiAuth';
import { createQuotationSchema } from '@/lib/validations';
import { createQuotation, listQuotations } from '@/services/quotationService';

export async function GET() {
  try {
    await requireAuth();
    const quotes = await listQuotations();
    return NextResponse.json(quotes, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return handleApiError(error, 'Failed to fetch quotations');
  }
}

export async function POST(request: NextRequest) {
  try {
    await validateCsrf(request);
    const user = await requireAuth();
    const parsed = createQuotationSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }
    const created = await createQuotation(parsed.data, user);
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return handleApiError(error, 'Failed to create quotation');
  }
}
