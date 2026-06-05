import prisma from '@/lib/prisma';
import { CategoriesClient } from '@/components/categories/CategoriesClient';

export default async function CategoriesPage() {
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
