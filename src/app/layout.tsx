import type { Metadata } from 'next';
import '@/app/globals.css';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/components/ThemeProvider';

export const metadata: Metadata = {
  title: 'ShwePOS - Enterprise POS System',
  description:
    'ShwePOS is a modern enterprise Point of Sale system built for Myanmar businesses. Manage sales, inventory, customers, and analytics with bilingual support.',
  keywords: ['POS', 'Point of Sale', 'Myanmar', 'ShwePOS', 'Retail', 'Inventory'],
  authors: [{ name: 'ShwePOS Team' }],
  icons: {
    icon: '/logo.png',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <ToastProvider>
          <ThemeProvider>{children}</ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
