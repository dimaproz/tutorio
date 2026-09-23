'use client';

import Link from 'next/link';
import { MailIcon, PencilIcon, PhoneIcon, SendIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ParentDetail } from '@tutorio/validation';
import { ContactRow } from '@/components/shared/contact-row';
import { InfoCard } from '@/components/shared/info-card';
import { Button } from '@/components/ui/button';
import { telegramHandle } from '@/features/parents/model/presentation';

/**
 * How to reach the parent. A missing contact becomes the link that adds it,
 * so the card never shows an empty line.
 */
export function ParentContactsCard({ parent }: { parent: ParentDetail }) {
  const t = useTranslations('parents.detail');
  const handle = telegramHandle(parent.telegramUsername);
  const editHref = `/app/parents/${parent.id}/edit#parent-form-contacts`;

  const rows = [
    parent.phone ? { key: 'phone', icon: PhoneIcon, value: parent.phone, mono: true } : null,
    handle ? { key: 'telegram', icon: SendIcon, value: `@${handle}`, mono: false } : null,
    parent.email ? { key: 'email', icon: MailIcon, value: parent.email, mono: false } : null,
  ].filter((row) => row !== null);
  const missing = [
    !parent.phone ? { key: 'phone', icon: PhoneIcon, label: t('addPhone') } : null,
    !handle ? { key: 'telegram', icon: SendIcon, label: t('addTelegram') } : null,
    !parent.email ? { key: 'email', icon: MailIcon, label: t('addEmail') } : null,
  ].filter((row) => row !== null);

  return (
    <InfoCard
      title={t('contactsTitle')}
      action={
        <Button
          asChild
          variant="paper"
          size="icon-xs"
          className="max-md:size-11"
          aria-label={t('editContacts')}
        >
          <Link href={editHref}>
            <PencilIcon />
          </Link>
        </Button>
      }
    >
      {rows.map((row) => (
        <ContactRow key={row.key} icon={row.icon} mono={row.mono}>
          {row.value}
        </ContactRow>
      ))}
      {missing.map((row) => (
        <ContactRow key={row.key} icon={row.icon} className="text-muted-foreground">
          <Link
            href={editHref}
            className="inline-flex items-center font-medium text-tint-indigo-foreground no-underline hover:underline max-md:min-h-11"
          >
            {row.label}
          </Link>
        </ContactRow>
      ))}
    </InfoCard>
  );
}
