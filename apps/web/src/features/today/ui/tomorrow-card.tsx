'use client';

import { useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowRightIcon, ChevronRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

/**
 * «Завтра» (S11 block 3): one line — the date, how many lessons and the first
 * one's time — that opens in place into short rows, with «У календарі →» on
 * tomorrow's day. With nothing tomorrow it says so. At the end of the day it
 * starts open.
 */
export function TomorrowCard({
  summary,
  calendarHref,
  rows,
  defaultOpen = false,
}: {
  /** «неділя, 27 вересня · 4 заняття · перше о 09:00», or «занять немає». */
  summary: string;
  calendarHref: string;
  rows: { key: string; row: ReactNode }[];
  defaultOpen?: boolean;
}) {
  const t = useTranslations('today.tomorrow');
  const [open, setOpen] = useState(defaultOpen);
  const empty = rows.length === 0;

  return (
    <Card className="gap-0 px-5 py-4">
      <Collapsible open={open && !empty} onOpenChange={setOpen}>
        <div className="flex items-center gap-3">
          <CollapsibleTrigger
            disabled={empty}
            className="group flex min-w-0 grow items-center gap-3 rounded-control text-left outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:cursor-default"
          >
            <ChevronRightIcon
              aria-hidden="true"
              className={cn(
                'size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-data-[state=open]:rotate-90',
                empty && 'invisible',
              )}
            />
            <span className="flex min-w-0 flex-col gap-0.5 md:flex-row md:items-baseline md:gap-3">
              <span className="text-[15px] leading-5 font-semibold">{t('title')}</span>
              <span className="text-sm leading-5 text-muted-foreground">{summary}</span>
            </span>
          </CollapsibleTrigger>
          <Link
            href={calendarHref}
            className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand outline-none hover:underline focus-visible:outline-2 focus-visible:outline-ring md:inline-flex [&_svg]:size-4"
          >
            {t('calendar')}
            <ArrowRightIcon aria-hidden="true" />
          </Link>
        </div>
        <CollapsibleContent className="flex flex-col gap-2 pt-3.5">
          {rows.map(({ key, row }) => (
            <div key={key}>{row}</div>
          ))}
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
