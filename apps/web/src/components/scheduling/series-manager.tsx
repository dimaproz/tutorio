'use client';

import { useMemo, useState } from 'react';
import { PencilIcon, PlusIcon, RepeatIcon, Trash2Icon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import type { LessonSeriesResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Empty } from '@/components/ui/empty';
import { PageHeader, ListSkeleton, QueryErrorAlert } from '@/components/app/page-shell';
import { useDeleteSeriesMutation, useSeriesListQuery } from '@/lib/api/scheduling';
import { SeriesFormDialog } from './series-form-dialog';

function useWeekdayLabels(locale: string): string[] {
  return useMemo(() => {
    const fmt = new Intl.DateTimeFormat(locale, { weekday: 'short' });
    return Array.from({ length: 7 }, (_, i) => fmt.format(new Date(Date.UTC(2024, 0, 7 + i))));
  }, [locale]);
}

export function SeriesManager() {
  const t = useTranslations('scheduling.patterns');
  const locale = useLocale();
  const labels = useWeekdayLabels(locale);
  const series = useSeriesListQuery({ page: 1 });
  const deleteSeries = useDeleteSeriesMutation();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<LessonSeriesResponse | undefined>();

  const openCreate = () => {
    setEditing(undefined);
    setFormOpen(true);
  };
  const openEdit = (item: LessonSeriesResponse) => {
    setEditing(item);
    setFormOpen(true);
  };
  const remove = (id: string) => {
    if (window.confirm(t('deleteConfirm'))) {
      deleteSeries.mutate(id);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title={t('title')}
        description={t('subtitle')}
        action={
          <Button onClick={openCreate}>
            <PlusIcon className="size-4" />
            {t('newPattern')}
          </Button>
        }
      />

      {series.isPending ? (
        <ListSkeleton />
      ) : series.isError ? (
        <QueryErrorAlert error={series.error} title={t('title')} onRetry={() => series.refetch()} />
      ) : series.data.items.length === 0 ? (
        <Empty>
          <RepeatIcon className="size-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{t('empty')}</p>
        </Empty>
      ) : (
        <div className="flex flex-col gap-2">
          {series.data.items.map((item) => (
            <Card key={item.id} className="flex flex-row items-center justify-between p-4">
              <div className="flex flex-col gap-1">
                <span className="font-medium">
                  {item.student?.fullName ?? item.group?.name ?? '—'}
                </span>
                <span className="text-sm text-muted-foreground">
                  {item.weekdays
                    .slice()
                    .sort((a, b) => a - b)
                    .map((day) => labels[day])
                    .join(', ')}{' '}
                  · {item.localTime} · {item.durationMin}m · {item.teacher.name}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" onClick={() => openEdit(item)}>
                  <PencilIcon className="size-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => remove(item.id)}>
                  <Trash2Icon className="size-4" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <SeriesFormDialog open={formOpen} onOpenChange={setFormOpen} series={editing} />
    </div>
  );
}
