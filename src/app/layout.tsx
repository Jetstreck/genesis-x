import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'GENESIS V3 — Cinematic Earth Foundation',
  description: 'An interactive, high-fidelity 3D Earth and atmospheric simulation representing the future of planet-scale visualization.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
