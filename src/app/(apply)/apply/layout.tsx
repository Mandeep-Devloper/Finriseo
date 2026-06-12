import React from 'react';
import { ApplyLayout } from '@/components/layout/ApplyLayout';

export default function ApplyFlowLayout({ children }: { children: React.ReactNode }) {
  return <ApplyLayout>{children}</ApplyLayout>;
}
