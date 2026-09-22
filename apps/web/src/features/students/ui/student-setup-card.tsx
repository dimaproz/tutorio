'use client';

import { BookOpenIcon, CalendarPlusIcon, ContactIcon, PackagePlusIcon, PencilIcon, XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Item, ItemActions, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

const actions = [
  ['lesson', CalendarPlusIcon],
  ['package', PackagePlusIcon],
  ['learning', BookOpenIcon],
  ['parent', ContactIcon],
  ['profile', PencilIcon],
] as const;

export function StudentSetupCard({
  onDismiss,
  onAction,
}: {
  onDismiss: () => void;
  onAction: (action: (typeof actions)[number][0]) => void;
}) {
  const t = useTranslations('students.setup');
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('title')}</CardTitle>
        <CardDescription>{t('description')}</CardDescription>
        <CardAction><Button type="button" variant="ghost" size="icon" aria-label={t('dismiss')} onClick={onDismiss}><XIcon data-icon /></Button></CardAction>
      </CardHeader>
      <CardContent><ul className="flex flex-col gap-2">{actions.map(([action, Icon]) => <li key={action}><Item variant="outline"><ItemMedia variant="icon"><Icon /></ItemMedia><ItemContent><ItemTitle>{t(`${action}.title`)}</ItemTitle><ItemDescription>{t(`${action}.description`)}</ItemDescription></ItemContent><ItemActions><Button type="button" variant="outline" size="sm" onClick={() => onAction(action)}>{t(`${action}.action`)}</Button></ItemActions></Item></li>)}</ul></CardContent>
    </Card>
  );
}
