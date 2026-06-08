import { ReportsClient } from '@/components/reports/ReportsClient';
import { requirePageRole } from '@/lib/pageAuth';

export default async function ReportsPage() {
  await requirePageRole('MANAGER', 'ADMIN');

  return <ReportsClient />;
}
