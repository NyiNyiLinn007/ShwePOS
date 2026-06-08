import prisma from '@/lib/prisma';
import { CategoriesClient } from '@/components/categories/CategoriesClient';
import { requirePageRole } from '@/lib/pageAuth';

export default async function CategoriesPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return <CategoriesClient initialCategories={categories} />;
}
