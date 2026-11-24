import { requirePageRole } from '@/lib/pageAuth';
import { UsersClient } from '@/components/users/UsersClient';

export const dynamic = 'force-dynamic';

export default async function UsersPage() {
  const session = await requirePageRole('ADMIN');
  return <UsersClient currentUserId={session.user.id} />;
}
