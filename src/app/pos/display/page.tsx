import prisma from '@/lib/prisma';
import { requirePageAuth } from '@/lib/pageAuth';
import { CustomerDisplayClient } from '@/components/pos/CustomerDisplayClient';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Customer Display - ShwePOS',
};

export default async function CustomerDisplayPage() {
  await requirePageAuth();
  const settings = await prisma.settings.findFirst({ where: { id: 'default' } });

  return (
    <CustomerDisplayClient
      defaultBusinessName={settings?.businessName || 'ShwePOS'}
      defaultBusinessNameMm={settings?.businessNameMm || null}
      defaultLogo={settings?.logo || null}
      defaultReceiptFooter={settings?.receiptFooter || null}
    />
  );
}
