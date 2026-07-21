import type { Metadata } from 'next';
import { DesignShell } from './design-shell';

// The lab now inherits Onest and the TailAdmin theme from the root layout —
// no separate font load or theme scoping needed here.
export const metadata: Metadata = {
  title: 'Tutorio — дизайн-лабораторія',
  robots: { index: false, follow: false },
};

export default function DesignLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DesignShell>{children}</DesignShell>;
}
