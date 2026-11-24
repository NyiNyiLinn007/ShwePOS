import { requirePageAuth } from '@/lib/pageAuth';
import { DashboardShell } from '@/components/layout/DashboardShell';

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requirePageAuth();

  return <DashboardShell session={session}>{children}</DashboardShell>;
}
