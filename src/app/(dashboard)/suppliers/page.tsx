import { requirePageRole } from '@/lib/pageAuth';
import { listSuppliers } from '@/services/supplierService';
import { SuppliersClient } from '@/components/suppliers/SuppliersClient';

export const metadata = {
  title: 'Suppliers - ShwePOS',
};

export default async function SuppliersPage() {
  const session = await requirePageRole('MANAGER', 'ADMIN');
  const suppliers = await listSuppliers(null, true);

  return (
    <SuppliersClient
      initialSuppliers={suppliers as Parameters<typeof SuppliersClient>[0]['initialSuppliers']}
      userRole={session.user.role}
    />
  );
}
