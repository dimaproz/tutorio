'use client';

import { useState, type ReactNode } from 'react';
import { BanknoteIcon, PackagePlusIcon, PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * The main column of the profile: one card whose segments switch between the
 * student's lessons, their package history and their payments (S06 decision
 * 11). History has no read surface yet, so it keeps its segment and says what
 * is coming instead of disappearing.
 */
export function StudentSectionsCard({
  lessons,
  packages,
  payments,
  onAddLesson,
  onAddPackage,
  onRecordPayment,
  historyOnly = false,
}: {
  lessons: ReactNode;
  packages: ReactNode;
  payments: ReactNode;
  onAddLesson?: () => void;
  onAddPackage?: () => void;
  onRecordPayment?: () => void;
  /** Archived profiles only read their history, so no section adds anything. */
  historyOnly?: boolean;
}) {
  const t = useTranslations('students.sections');
  const [section, setSection] = useState('lessons');

  // One action slot that belongs to the visible section: it changes with the
  // segment and disappears where the section has nothing to add.
  const action = historyOnly
    ? null
    : section === 'lessons' && onAddLesson
      ? { label: t('addLesson'), icon: <PlusIcon data-icon="inline-start" />, onClick: onAddLesson }
      : section === 'packages' && onAddPackage
        ? {
            label: t('addPackage'),
            icon: <PackagePlusIcon data-icon="inline-start" />,
            onClick: onAddPackage,
          }
        : section === 'payments' && onRecordPayment
          ? {
              label: t('recordPayment'),
              icon: <BanknoteIcon data-icon="inline-start" />,
              onClick: onRecordPayment,
            }
          : null;

  const actionButton = (className?: string) =>
    action ? (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={action.onClick}
        className={className}
      >
        {action.icon}
        {action.label}
      </Button>
    ) : null;

  return (
    <Card className="gap-3 p-4 md:p-5">
      <Tabs value={section} onValueChange={setSection} className="gap-3">
        <div className="flex flex-wrap items-center justify-between gap-3 md:px-1 md:pt-1 md:pb-2">
          {/* Four segments do not fit a phone, so the row scrolls rather than
              shrinking its touch targets. */}
          <div className="max-w-full overflow-x-auto">
            <TabsList variant="segmented-subtle" aria-label={t('label')} className="bg-background">
              <TabsTrigger value="lessons">{t('lessons')}</TabsTrigger>
              <TabsTrigger value="packages">{t('packages')}</TabsTrigger>
              <TabsTrigger value="payments">{t('payments')}</TabsTrigger>
              <TabsTrigger value="history">{t('history')}</TabsTrigger>
            </TabsList>
          </div>
          {actionButton('hidden md:inline-flex')}
        </div>
        <TabsContent value="lessons">{lessons}</TabsContent>
        <TabsContent value="packages">{packages}</TabsContent>
        <TabsContent value="payments">{payments}</TabsContent>
        <TabsContent value="history">
          <SectionComingSoon title={t('history')} />
        </TabsContent>
        {actionButton('w-full md:hidden')}
      </Tabs>
    </Card>
  );
}

function SectionComingSoon({ title }: { title: string }) {
  const t = useTranslations('students.sections');

  return (
    <Empty>
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{t('comingSoon')}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
