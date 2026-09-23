'use client';

import { ArrowRightIcon, PhoneIcon, SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentListItem } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { telegramHandle } from '@/features/parents/model/presentation';
import { ParentIdentityCell, ParentStudentsAvatars } from './parent-row-cells';

/**
 * The phone representation of a parent in the collection: identity with the
 * way into the profile, then the linked students and one-tap contacts. The
 * whole card is the link to the profile; the contact buttons sit above it.
 */
export function ParentCard({ parent }: { parent: ParentListItem }) {
  const t = useTranslations('parents');
  const handle = telegramHandle(parent.telegramUsername);
  const hasContacts = Boolean(parent.phone || handle);

  return (
    <article
      data-slot="parent-card"
      className="relative flex flex-col gap-3 rounded-row bg-card p-4 text-card-foreground transition-colors duration-150 has-[a:hover]:bg-surface-hover"
    >
      <div className="flex items-center gap-3">
        <div className="min-w-0 grow">
          <ParentIdentityCell parent={parent} size="lg" />
        </div>
        <ArrowRightIcon aria-hidden="true" className="size-5 shrink-0 text-foreground" />
      </div>
      {parent.students.length > 0 || hasContacts ? (
        <div className="flex min-h-11 items-center gap-2 border-t border-border pt-3">
          <div className="flex min-w-0 grow items-center gap-2">
            {parent.students.length > 0 ? (
              <>
                <ParentStudentsAvatars students={parent.students} max={2} />
                <span className="truncate text-sm">
                  {parent.students.map((student) => student.fullName).join(', ')}
                </span>
              </>
            ) : (
              <span className="text-[13px] text-muted-foreground">{t('noStudents')}</span>
            )}
          </div>
          {/* Above the card link, so a tap calls instead of opening the profile. */}
          <div className="relative z-1 flex shrink-0 gap-2">
            {parent.phone ? (
              <Button
                asChild
                variant="paper"
                size="icon"
                aria-label={t('callName', { name: parent.fullName })}
              >
                <a href={`tel:${parent.phone}`}>
                  <PhoneIcon />
                </a>
              </Button>
            ) : null}
            {handle ? (
              <Button
                asChild
                variant="paper"
                size="icon"
                aria-label={t('messageName', { name: parent.fullName })}
              >
                <a href={`https://t.me/${handle}`} target="_blank" rel="noreferrer">
                  <SendIcon />
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      ) : null}
    </article>
  );
}
