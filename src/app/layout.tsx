import type { Metadata } from 'next';
import { Suspense } from 'react';
import '@/app/globals.css';
import { ToastProvider } from '@/contexts/ToastContext';
import { ThemeProvider } from '@/components/ThemeProvider';
import { GlobalLoadingBar } from '@/components/ui/GlobalLoadingBar';

export const metadata: Metadata = {
  title: 'ShwePOS - Enterprise POS System',
  description:
    'ShwePOS is a modern enterprise Point of Sale system built for Myanmar businesses. Manage sales, inventory, customers, and analytics with bilingual support.',
  keywords: ['POS', 'Point of Sale', 'Myanmar', 'ShwePOS', 'Retail', 'Inventory'],
  authors: [{ name: 'ShwePOS Team' }],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ShwePOS',
  },
  icons: {
    icon: '/logo.png',
    apple: '/logo.png',
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
          <ThemeProvider>
            <Suspense fallback={null}>
              <GlobalLoadingBar />
            </Suspense>
            {children}
          </ThemeProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
