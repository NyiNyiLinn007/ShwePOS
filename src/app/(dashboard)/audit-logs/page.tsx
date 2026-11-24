import prisma from '@/lib/prisma';
import { requirePageRole } from '@/lib/pageAuth';
import { listAuditLogs } from '@/services/auditService';
import { AuditLogsClient } from '@/components/audit/AuditLogsClient';

export const metadata = {
  title: 'Security Audit Logs - ShwePOS',
};

export default async function AuditLogsPage() {
  await requirePageRole('ADMIN');

  const [initialData, users] = await Promise.all([
    listAuditLogs({ page: 1, limit: 50 }),
    prisma.user.findMany({
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <AuditLogsClient
      initialLogs={initialData.logs as Parameters<typeof AuditLogsClient>[0]['initialLogs']}
      initialPagination={initialData.pagination}
      users={users}
    />
  );
}
