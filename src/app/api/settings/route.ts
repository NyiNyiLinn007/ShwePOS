import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth, requireRole, handleApiError } from '@/lib/apiAuth';
import { updateSettingsSchema } from '@/lib/validations';

export async function GET() {
  try {
    await requireAuth();

    let settings = await prisma.settings.findUnique({
      where: { id: 'default' },
    });

    if (!settings) {
      settings = await prisma.settings.create({
        data: {
          id: 'default',
          businessName: 'ShwePOS',
          businessNameMm: 'ရွှေPOS',
          taxRate: 0,
          currencySymbol: 'K',
        },
      });
    }

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, 'Failed to fetch settings');
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireRole('ADMIN');

    const body = await request.json();
    const parsed = updateSettingsSchema.parse(body);
    const {
      businessName,
      businessNameMm,
      address,
      phone,
      email,
      taxRate,
      currencySymbol,
      logo,
      receiptFooter,
    } = parsed;

    const settings = await prisma.settings.upsert({
      where: { id: 'default' },
      update: {
        ...(businessName !== undefined && { businessName }),
        ...(businessNameMm !== undefined && { businessNameMm: businessNameMm || null }),
        ...(address !== undefined && { address: address || null }),
        ...(phone !== undefined && { phone: phone || null }),
        ...(email !== undefined && { email: email || null }),
        ...(taxRate !== undefined && { taxRate: Number(taxRate) }),
        ...(currencySymbol !== undefined && { currencySymbol }),
        ...(logo !== undefined && { logo: logo || null }),
        ...(receiptFooter !== undefined && { receiptFooter: receiptFooter || null }),
      },
      create: {
        id: 'default',
        businessName: businessName || 'ShwePOS',
        businessNameMm: businessNameMm || 'ရွှေPOS',
        address: address || null,
        phone: phone || null,
        email: email || null,
        taxRate: taxRate !== undefined ? Number(taxRate) : 0,
        currencySymbol: currencySymbol || 'K',
        logo: logo || null,
        receiptFooter: receiptFooter || null,
      },
    });

    return NextResponse.json(settings);
  } catch (error) {
    return handleApiError(error, 'Failed to update settings');
  }
}
