import './globals.css';
import { Analytics } from '@vercel/analytics/react';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="bg-black text-white min-h-screen">
        {children}
        <Analytics />
      </body>
    </html>
  );
}