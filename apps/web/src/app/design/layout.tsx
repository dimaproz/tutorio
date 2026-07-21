import type { Metadata } from 'next';
import { Onest } from 'next/font/google';
import { DesignShell } from './design-shell';

// TailAdmin's interface face is Outfit, a geometric grotesque with no Cyrillic
// coverage. Onest is its near-twin and carries Cyrillic properly, so Ukrainian
// copy keeps the same geometric texture across headings, figures and controls.
const onest = Onest({
  variable: '--font-onest',
  subsets: ['latin', 'cyrillic'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tutorio — дизайн-лабораторія',
  robots: { index: false, follow: false },
};

export default function DesignLabLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <DesignShell fontVariables={onest.variable}>{children}</DesignShell>;
}
