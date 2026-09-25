'use client';

import type { ReactNode } from 'react';
import {
  BanknoteIcon,
  CalendarClockIcon,
  CircleCheckIcon,
  InfoIcon,
  PackageIcon,
} from 'lucide-react';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { TicketArt } from '@/components/shared/pass-art';
import { cn } from '@/lib/utils';
import { CreditDots } from '../credit-dots';
import { notchMask } from '../notch';

/** The stub of a new package: its label, the count with its dots, the window and the art. */
function NewStub({
  label,
  labelIcon,
  lessons,
  lessonsWord,
  window,
  className,
}: {
  label: ReactNode;
  labelIcon: ReactNode;
  lessons: number;
  lessonsWord: ReactNode;
  window: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('relative flex flex-col gap-2 bg-tint-indigo px-6 py-5', className)}>
      <TicketArt className="absolute top-4 right-4 h-15 w-19 text-brand" />
      <span className="flex items-center gap-1.5 pr-20 text-xs font-bold tracking-[0.06em] text-brand uppercase [&_svg]:size-3.5">
        {labelIcon}
        {label}
      </span>
      <span className="flex items-baseline gap-2.5">
        <span className="text-[52px] leading-none font-bold tracking-[-0.03em] tabular-nums">
          {lessons}
        </span>
        <span className="text-xl font-semibold opacity-60">{lessonsWord}</span>
      </span>
      <CreditDots left={lessons} total={lessons} size="md" />
      <span className="text-[13px] leading-[18px] text-tint-foreground">{window}</span>
    </div>
  );
}

/**
 * «Так виглядатиме» (board 01): the package as it will be — the stub, the
 * tear line, the price per lesson and the total, and what happens first
 * (the lessons on debt it covers, the package it follows) — or, while the
 * form cannot describe one, a dashed card saying what to fill in.
 */
export function SalePreview({
  heading,
  ready,
  emptyText,
  label,
  name,
  lessons,
  lessonsWord,
  window,
  rows,
  notes,
}: {
  heading: string;
  ready: boolean;
  emptyText: string;
  label: string;
  /** The package's name, over the prices. */
  name: string;
  lessons: number;
  lessonsWord: string;
  window: string;
  rows: { label: string; value: string }[];
  notes: { icon: 'debt' | 'queue'; text: string }[];
}) {
  return (
    <section aria-label={heading} className="flex flex-col gap-3">
      <span className="text-xs font-bold tracking-[0.06em] text-muted-foreground uppercase">
        {heading}
      </span>
      {ready ? (
        <div className="flex flex-col overflow-hidden rounded-block border border-border bg-card">
          <NewStub
            label={label}
            labelIcon={<PackageIcon />}
            lessons={lessons}
            lessonsWord={lessonsWord}
            window={window}
          />
          <div aria-hidden="true" className="mx-5 border-t-2 border-dashed border-border" />
          <span className="truncate px-6 pt-4 text-[15px] font-semibold">{name}</span>
          <dl className="flex flex-col gap-2.5 px-6 pt-3">
            {rows.map((row, index) => (
              <div
                key={row.label}
                className={cn(
                  'flex items-baseline justify-between gap-3 text-sm',
                  index === rows.length - 1 && 'border-b border-border pb-3',
                )}
              >
                <dt className="text-muted-foreground">{row.label}</dt>
                <dd className="font-bold tabular-nums">{row.value}</dd>
              </div>
            ))}
          </dl>
          <ul className="flex flex-col gap-2 px-6 pt-3 pb-5 text-[13px] leading-[18px] text-muted-foreground">
            {notes.map((note) => (
              <li
                key={note.text}
                className="flex items-start gap-2 [&_svg]:mt-px [&_svg]:size-3.5 [&_svg]:shrink-0"
              >
                {note.icon === 'debt' ? (
                  <InfoIcon aria-hidden="true" />
                ) : (
                  <CalendarClockIcon aria-hidden="true" />
                )}
                {note.text}
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex min-h-68 flex-col items-center justify-center gap-3 rounded-block border-2 border-dashed border-border px-8 text-center text-sm text-muted-foreground">
          <PackageIcon aria-hidden="true" className="size-6" />
          {emptyText}
        </div>
      )}
    </section>
  );
}

/**
 * The sold package (board 01, state 06): the stub on the left — «Продано»,
 * the count and its dots, the window — the tear line with its notches, and
 * the body with the package, who it is for, its prices and whether money
 * came in. On phones the stub sits on top.
 */
export function SoldTicket({
  mobile,
  label,
  lessons,
  lessonsWord,
  window,
  title,
  line,
  teacher,
  figures,
  paidNote,
  paid,
}: {
  mobile: boolean;
  label: string;
  lessons: number;
  lessonsWord: string;
  window: string;
  title: string;
  line: string;
  teacher: { name: string; avatarKey: string | null };
  figures: { label: string; value: string }[];
  paidNote: string;
  paid: boolean;
}) {
  const STUB = 290;
  const PHONE_STUB = 180;
  return (
    <article
      style={notchMask(mobile ? { y: PHONE_STUB } : { x: STUB }, 11)}
      className="flex flex-col overflow-hidden rounded-block border border-border bg-card md:flex-row"
    >
      <NewStub
        label={label}
        labelIcon={<CircleCheckIcon />}
        lessons={lessons}
        lessonsWord={lessonsWord}
        window={window}
        className="h-[180px] justify-center md:h-auto md:w-[290px] md:shrink-0"
      />
      <div
        aria-hidden="true"
        className="mx-4 border-t-2 border-dashed border-border md:mx-0 md:my-4 md:border-t-0 md:border-l-2"
      />
      <div className="flex min-w-0 grow flex-col gap-4 p-5 md:p-6">
        <div className="flex items-start gap-3">
          <EntityAvatar avatarKey={teacher.avatarKey} fullName={teacher.name} size="md" />
          <div className="flex min-w-0 flex-col gap-0.5">
            <span className="truncate text-lg leading-6 font-bold">{title}</span>
            <span className="text-sm text-muted-foreground">{line}</span>
          </div>
        </div>
        <dl className="grid grid-cols-3 gap-3">
          {figures.map((figure) => (
            <div key={figure.label} className="flex flex-col gap-1">
              <dt className="text-[13px] text-muted-foreground">{figure.label}</dt>
              <dd className="text-lg font-bold tabular-nums">{figure.value}</dd>
            </div>
          ))}
        </dl>
        <span
          className={cn(
            'flex items-center gap-2.5 rounded-row px-4 py-3 text-sm [&_svg]:size-4',
            paid
              ? 'bg-tint-success text-tint-success-foreground'
              : 'bg-tint-warning text-foreground',
          )}
        >
          <BanknoteIcon
            aria-hidden="true"
            className={paid ? undefined : 'text-tint-warning-foreground'}
          />
          {paidNote}
        </span>
      </div>
    </article>
  );
}
