'use client';

import type { ReactNode } from 'react';
import { PlusIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

/**
 * The main column of the profile: one card whose segments switch between the
 * student's lessons and their packages. Payments and history are part of the
 * approved design but have no read surface yet, so each keeps its segment and
 * says what is coming instead of disappearing.
 */
export function StudentSectionsCard({
  lessons,
  packages,
  onAddLesson,
}: {
  lessons: ReactNode;
  packages: ReactNode;
  onAddLesson?: () => void;
}) {
  const t = useTranslations('students.sections');

  return (
    <Card className="gap-4 p-5">
      <Tabs defaultValue="lessons">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Four segments do not fit a phone, so the row scrolls rather than
              shrinking its touch targets. */}
          <div className="max-w-full overflow-x-auto">
          <TabsList variant="segmented-subtle" aria-label={t('label')}>
            <TabsTrigger value="lessons">{t('lessons')}</TabsTrigger>
            <TabsTrigger value="packages">{t('packages')}</TabsTrigger>
            <TabsTrigger value="payments">{t('payments')}</TabsTrigger>
            <TabsTrigger value="history">{t('history')}</TabsTrigger>
          </TabsList>
          </div>
          {onAddLesson ? (
            <Button type="button" variant="outline" size="sm" onClick={onAddLesson}>
              <PlusIcon data-icon="inline-start" />
              {t('addLesson')}
            </Button>
          ) : null}
        </div>
        <TabsContent value="lessons" className="pt-2">
          {lessons}
        </TabsContent>
        <TabsContent value="packages" className="pt-2">
          {packages}
        </TabsContent>
        <TabsContent value="payments" className="pt-2">
          <SectionComingSoon title={t('payments')} />
        </TabsContent>
        <TabsContent value="history" className="pt-2">
          <SectionComingSoon title={t('history')} />
        </TabsContent>
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
