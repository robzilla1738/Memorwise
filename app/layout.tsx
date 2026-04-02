import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Memorwise',
  description: 'Your local, open-source notebook for chatting with documents',
  icons: { icon: '/favicon.png' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#09090b',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className="bg-background text-foreground overflow-hidden h-screen">
        {children}
      </body>
    </html>
  );
}
