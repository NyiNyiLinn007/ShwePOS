import { requirePageAuth } from '@/lib/pageAuth';
import ShiftClient from '@/components/shifts/ShiftClient';

export const metadata = {
  title: 'Cashier Shifts - ShwePOS',
};

export default async function ShiftsPage() {
  const session = await requirePageAuth();

  return (
    <ShiftClient
      userRole={session.user.role}
      userName={session.user.name ?? 'User'}
    />
  );
}
