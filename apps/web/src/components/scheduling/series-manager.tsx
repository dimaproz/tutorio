'use client';

import { useState } from 'react';
import { PencilIcon, PlusIcon, RepeatIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import type { LessonSeriesResponse } from '@tutorio/validation';
import { ConfirmDialog } from '@/components/app/confirm-dialog';
import { PageHeader, QueryErrorAlert } from '@/components/app/page-shell';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { useDeleteSeriesMutation, useSeriesListQuery } from '@/lib/api/scheduling';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { SeriesFormDialog } from './series-form-dialog';
import { LoadingPanel } from '@/components/shared';

export function SeriesManager() {
  const t = useTranslations('scheduling.patterns');
  const tCommon = useTranslations('common');
  const labels = useWeekdayLabels();
  const series = useSeriesListQuery({ page: 1 });
  const deleteSeries = useDeleteSeriesMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LessonSeriesResponse | undefined>();
  const [pendingDelete, setPendingDelete] = useState<LessonSeriesResponse | null>(null);

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };

  const openEdit = (item: LessonSeriesResponse) => {
    setEditing(item);
    setFormOpen(true);
  };

  async function onDelete() {
    if (!pendingDelete) {
      return;
    }
    try {
      await deleteSeries.mutateAsync(pendingDelete.id);
      toast.success(t('toastDeleted'));
      setPendingDelete(null);
    } catch {
      // The mutation's error state is surfaced by the list query on refetch.
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button onClick={openCreate}>
            <PlusIcon data-icon="inline-start" />
            {t('newPattern')}
          </Button>
        }
      />

      {series.isPending ? (
        <LoadingPanel size="lg" />
      ) : series.isError ? (
        <QueryErrorAlert
          error={series.error}
          title={t('title')}
          onRetry={() => void series.refetch()}
        />
      ) : series.data.items.length === 0 ? (
        <Empty className="border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <RepeatIcon />
            </EmptyMedia>
            <EmptyTitle>{t('empty')}</EmptyTitle>
            <EmptyDescription>{t('subtitle')}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={openCreate}>
              <PlusIcon data-icon="inline-start" />
              {t('newPattern')}
            </Button>
          </EmptyContent>
        </Empty>
      ) : (
        <div className="flex flex-col gap-3">
          {series.data.items.map((item) => (
            <Card key={item.id}>
              <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 flex-col gap-1">
                  <span className="truncate font-medium">
                    {item.student?.fullName ?? item.group?.name ?? '—'}
                  </span>
                  <span className="text-muted-foreground tabular text-sm">
                    {item.weekdays
                      .slice()
                      .sort((a, b) => a - b)
                      .map((day) => labels[day])
                      .join(', ')}{' '}
                    · {item.localTime} · {t('minutes', { count: item.durationMin })} ·{' '}
                    {item.teacher.name}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => openEdit(item)}
                    aria-label={tCommon('edit')}
                  >
                    <PencilIcon />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setPendingDelete(item)}
                    aria-label={tCommon('delete')}
                  >
                    <Trash2Icon />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SeriesFormDialog open={formOpen} onOpenChange={setFormOpen} series={editing} />

      <ConfirmDialog
        open={pendingDelete !== null}
        onOpenChange={(next) => !next && setPendingDelete(null)}
        title={t('deleteTitle')}
        description={t('deleteConfirm')}
        confirmLabel={tCommon('delete')}
        onConfirm={() => void onDelete()}
        pending={deleteSeries.isPending}
      />
    </div>
  );
}
