import React from 'react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Apply for Loan | Finriseo',
  description: 'Apply for a personal, business or education loan. Instant approval, zero paperwork.',
  robots: { index: false, follow: false }, // Don't index apply flow
};
export default function ApplyRootLayout({ children }: { children: React.ReactNode }) {
  // This route group explicitly avoids the marketing Navbar and Footer.
  // It simply passes children through to the nested layouts.
  return <>{children}</>;
}
