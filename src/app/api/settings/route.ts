import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
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
    console.error('Failed to fetch settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
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
    } = body;

    // Validate tax rate
    if (taxRate !== undefined) {
      const rate = Number(taxRate);
      if (isNaN(rate) || rate < 0 || rate > 100) {
        return NextResponse.json(
          { error: 'Tax rate must be between 0 and 100' },
          { status: 400 }
        );
      }
    }

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
    console.error('Failed to update settings:', error);
    return NextResponse.json(
      { error: 'Failed to update settings' },
      { status: 500 }
    );
  }
}
