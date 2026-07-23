'use client';

import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';

// The single "back" control — one clean, aligned look everywhere. Plain gap
// (no data-icon padding trick, which left the arrow lopsided) and a muted tone
// that reads as secondary navigation.
export function BackButton({ href, label }: { href: string; label?: string }) {
  const tCommon = useTranslations('common');
  return (
    <Button
      asChild
      variant="ghost"
      size="sm"
      className="-ml-2 gap-1.5 text-muted-foreground hover:text-foreground"
    >
      <Link href={href}>
        <ArrowLeftIcon className="size-4" />
        {label ?? tCommon('back')}
      </Link>
    </Button>
  );
}
