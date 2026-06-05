import prisma from '@/lib/prisma';
import { SettingsClient } from '@/components/settings/SettingsClient';

export default async function SettingsPage() {
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

  return <SettingsClient initialSettings={settings} initialUsers={users} />;
}
