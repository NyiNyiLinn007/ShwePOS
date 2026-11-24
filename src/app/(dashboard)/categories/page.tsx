import prisma from '@/lib/prisma';
import { CategoriesClient } from '@/components/categories/CategoriesClient';
import { requirePageRole } from '@/lib/pageAuth';

export default async function CategoriesPage() {
  const session = await requirePageRole('MANAGER', 'ADMIN');

  const categories = await prisma.category.findMany({
    include: {
      _count: {
        select: { products: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  return <CategoriesClient initialCategories={categories} userRole={session.user.role} />;
}
