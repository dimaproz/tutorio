'use client';

import { PersonMiniCard } from '@/components/app/person-mini-card';

// Everything the compact card can show — a superset of StudentParentRef and
// ParentListItem, so both the student form (rich, with contacts) and the
// student detail page can feed it the same component.
export interface ParentMiniCardData {
  id: string;
  fullName: string;
  avatarKey?: string | null;
  phone?: string | null;
  telegramUsername?: string | null;
}

function contactLine(parent: ParentMiniCardData): string | null {
  if (parent.phone) {
    return parent.phone;
  }
  if (parent.telegramUsername) {
    return `@${parent.telegramUsername.replace(/^@/, '')}`;
  }
  return null;
}

// Parent flavour of PersonMiniCard: the subtitle is the best available contact.
export function ParentMiniCard({
  parent,
  href,
  onRemove,
  removeLabel,
  className,
}: {
  parent: ParentMiniCardData;
  href?: string;
  onRemove?: () => void;
  removeLabel?: string;
  className?: string;
}) {
  return (
    <PersonMiniCard
      avatarKey={parent.avatarKey}
      fullName={parent.fullName}
      subtitle={contactLine(parent)}
      href={href}
      onRemove={onRemove}
      removeLabel={removeLabel}
      className={className}
    />
  );
}
