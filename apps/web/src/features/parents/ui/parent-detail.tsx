'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import type { ParentDetail } from '@tutorio/validation';
import { DetailFrame } from '@/components/shared/detail-frame';
import { LoadingPanel } from '@/components/shared/loading';
import { useSetPageCrumb } from '@/components/shared/page-crumb';
import { QueryErrorAlert } from '@/components/shared/page-shell';
import { useParentQuery } from '@/lib/api/parents';
import { ParentContactsCard } from './parent-contacts-card';
import { useParentDelete } from './parent-delete';
import { ParentNotesCard } from './parent-notes-card';
import { ParentProfileHero } from './parent-profile-hero';
import { ParentStudentsCard } from './parent-students-card';

export function ParentDetailView({ parentId }: { parentId: string }) {
  const t = useTranslations('parents');
  const parent = useParentQuery(parentId);
  if (parent.isPending) return <DetailFrame loading={<LoadingPanel size="lg" />} />;
  // A failed background refresh keeps the profile on screen; only a first
  // load that never produced data is an error page.
  if (!parent.data)
    return (
      <DetailFrame
        error={
          <QueryErrorAlert
            error={parent.error}
            title={t('error.detailTitle')}
            onRetry={() => void parent.refetch()}
          />
        }
      />
    );
  return <ParentProfileContent parent={parent.data} />;
}

/**
 * The parent profile: the hero, then the linked students, the contact details
 * and the notes. Parents have no lifecycle, so there is no status banner and
 * no status control.
 */
export function ParentProfileContent({ parent }: { parent: ParentDetail }) {
  const t = useTranslations('parents');
  const router = useRouter();
  useSetPageCrumb(t('detail.pageLabel'));
  const [pickerOpen, setPickerOpen] = useState(false);
  const removal = useParentDelete({ onDeleted: () => router.push('/app/parents') });

  return (
    <>
      <DetailFrame
        identity={
          <ParentProfileHero
            parent={parent}
            onLink={() => setPickerOpen(true)}
            canDelete={removal.canDelete}
            onDelete={() => removal.request(parent)}
          />
        }
        main={
          <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)_minmax(0,1fr)]">
            <ParentStudentsCard
              parent={parent}
              pickerOpen={pickerOpen}
              onPickerOpenChange={setPickerOpen}
            />
            <ParentContactsCard parent={parent} />
            <ParentNotesCard parent={parent} />
          </div>
        }
      />
      {removal.dialog}
    </>
  );
}
