'use client';

import { GraduationCapIcon, HistoryIcon, UserRoundIcon, UsersIcon } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { ImpactList } from '@/components/shared/impact-list';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Why the studio cannot go solo yet (`SOLO_MODE_SINGLE_TEACHER`, S10 board
 * 02-04): how many other teachers are active and that nothing changes. «До
 * викладачів» opens the teachers; a bottom sheet on phones.
 */
export function ModeRefusalDialog({
  open,
  onOpenChange,
  studio,
  others,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  studio: string;
  /** Active teachers besides the owner. */
  others: number;
}) {
  const t = useTranslations('settings.general.refusal');
  const router = useRouter();
  const mobile = useIsMobile();
  const size = mobile ? 'xl' : 'default';

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<UserRoundIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={t('title')}
      description={t('description', { name: studio })}
      closeLabel={t('close')}
      primary={
        <Button type="button" size={size} onClick={() => router.push('/app/teachers')}>
          <GraduationCapIcon data-icon="inline-start" />
          {t('toTeachers')}
        </Button>
      }
      secondary={
        <Button type="button" variant="outline" size={size} onClick={() => onOpenChange(false)}>
          {t('ok')}
        </Button>
      }
    >
      <ImpactList
        items={[
          {
            id: 'others',
            icon: <UsersIcon />,
            tone: 'warning',
            title: t('others', { count: others }),
            text: t('othersText'),
          },
          {
            id: 'keep',
            icon: <HistoryIcon />,
            tone: 'neutral',
            title: t('keep'),
            text: t('keepText'),
          },
        ]}
      />
    </AdaptiveDialog>
  );
}
