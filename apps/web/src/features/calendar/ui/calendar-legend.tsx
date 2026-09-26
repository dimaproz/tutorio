'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import type { CalendarTeacher } from './calendar-filters';
import { UnpaidMark } from './calendar-event';

function Swatch({ className }: { className: string }) {
  return <span aria-hidden="true" className={cn('size-3.5 shrink-0 rounded-[4px]', className)} />;
}

function Item({ media, label }: { media: ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-2 whitespace-nowrap">
      {media}
      {label}
    </li>
  );
}

/**
 * Under the grid: the teachers when several are shown (each in their own
 * colour, decision 6), the lesson types' colours, then what the fills mean.
 */
export function CalendarLegend({
  teachers = [],
  renderTeacher,
}: {
  teachers?: readonly CalendarTeacher[];
  renderTeacher?: (teacher: CalendarTeacher) => ReactNode;
}) {
  const t = useTranslations('calendar.legend');
  return (
    <ul
      aria-label={t('label')}
      data-slot="calendar-legend"
      className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm leading-5 text-foreground"
    >
      {teachers.map((teacher) => (
        <Item
          key={teacher.id}
          media={renderTeacher?.(teacher)}
          label={teacher.fullName.split(/\s+/)[0] ?? teacher.fullName}
        />
      ))}
      {teachers.length > 0 ? (
        <li aria-hidden="true" className="flex">
          <Separator orientation="vertical" className="h-5 data-[orientation=vertical]:h-5" />
        </li>
      ) : null}
      <Item media={<Swatch className="bg-brand" />} label={t('individual')} />
      <Item media={<Swatch className="bg-lesson-group" />} label={t('group')} />
      <Item media={<Swatch className="bg-lesson-makeup" />} label={t('makeup')} />
      <li aria-hidden="true" className="flex">
        <Separator orientation="vertical" className="h-5 data-[orientation=vertical]:h-5" />
      </li>
      <Item
        media={<Swatch className="lesson-individual border-[1.5px] border-brand bg-card" />}
        label={t('upcoming')}
      />
      <Item
        media={<Swatch className="bg-[color-mix(in_oklab,var(--brand)_10%,var(--card))]" />}
        label={t('past')}
      />
      <Item media={<Swatch className="border border-border bg-card" />} label={t('cancelled')} />
      <Item media={<UnpaidMark className="size-4 text-[10px]" />} label={t('unpaid')} />
    </ul>
  );
}
