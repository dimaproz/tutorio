'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { EntityAvatar } from '@/components/app/entity-avatar';

// The cells every collection table shares. A phone reads the same on students
// and on parents, and so does a person — keeping them here is what stops the
// two tables from drifting apart.

/** Em-dash-style placeholder for a value the tutor never filled in. */
export function EmptyCell() {
  const tCommon = useTranslations('common');
  return <span className="text-muted-foreground">{tCommon('notProvided')}</span>;
}

/** Avatar + name, optionally linked to the profile and with a second line. */
export function PersonCell({
  avatarKey,
  fullName,
  href,
  subtitle,
}: {
  avatarKey?: string | null;
  fullName: string;
  href?: string;
  subtitle?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <EntityAvatar avatarKey={avatarKey} fullName={fullName} size="md" />
      <div className="flex min-w-0 flex-col gap-1">
        {href ? (
          <Link
            href={href}
            className="truncate font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
          >
            {fullName}
          </Link>
        ) : (
          <span className="truncate font-medium">{fullName}</span>
        )}
        {subtitle ? (
          <span className="truncate text-xs text-muted-foreground">{subtitle}</span>
        ) : null}
      </div>
    </div>
  );
}

/** Several people in one cell — a parent's children, a group's members. */
export function PeopleCell({
  people,
  hrefFor,
}: {
  people: { id: string; fullName: string; avatarKey?: string | null; subtitle?: ReactNode }[];
  hrefFor?: (id: string) => string;
}) {
  if (people.length === 0) {
    return <EmptyCell />;
  }
  return (
    <div className="flex flex-col gap-2">
      {people.map((person) => (
        <PersonCell
          key={person.id}
          avatarKey={person.avatarKey}
          fullName={person.fullName}
          href={hrefFor?.(person.id)}
          subtitle={person.subtitle}
        />
      ))}
    </div>
  );
}

export function PhoneCell({ phone }: { phone: string | null }) {
  if (!phone) {
    return <EmptyCell />;
  }
  return (
    <a href={`tel:${phone}`} className="tabular underline-offset-4 hover:underline">
      {phone}
    </a>
  );
}

export function TelegramCell({ username }: { username: string | null }) {
  const handle = username?.replace(/^@/, '');
  if (!handle) {
    return <EmptyCell />;
  }
  return (
    <a
      href={`https://t.me/${handle}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 text-primary underline-offset-4 hover:underline"
    >
      <SendIcon className="size-3.5" aria-hidden="true" />@{handle}
    </a>
  );
}
