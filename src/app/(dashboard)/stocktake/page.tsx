import prisma from '@/lib/prisma';
import { requirePageRole } from '@/lib/pageAuth';
import { listStocktakeSessions } from '@/services/stocktakeService';
import { StocktakeClient } from '@/components/stocktake/StocktakeClient';

export const dynamic = 'force-dynamic';

export default async function StocktakePage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const [sessions, categories] = await Promise.all([
    listStocktakeSessions(),
    prisma.category.findMany({
      where: { isActive: true },
      select: { id: true, name: true, nameMm: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return <StocktakeClient initialSessions={sessions} categories={categories} />;
}
