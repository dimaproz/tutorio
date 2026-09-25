'use client';

import { UserRoundIcon, UsersIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { Notice } from '@/components/shared/notice';
import { Button } from '@/components/ui/button';
import { useIsMobile } from '@/hooks/use-mobile';

/**
 * Why the studio cannot switch to tutor mode (`SOLO_MODE_SINGLE_TEACHER`,
 * S09 board 01-07): how many other active teachers there are and what to do,
 * without naming them. A bottom sheet on phones.
 */
export function SoloRefusalDialog({
  open,
  onOpenChange,
  others,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Other active teachers in the studio. */
  others: number;
}) {
  const t = useTranslations('teachers.soloRefusal');
  const tArchive = useTranslations('teachers.archive');
  const mobile = useIsMobile();
  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onOpenChange}
      icon={<UserRoundIcon />}
      iconClassName="bg-tint-warning text-tint-warning-foreground"
      title={t('title')}
      description={t('description')}
      closeLabel={tArchive('close')}
      primary={
        <Button type="button" size={mobile ? 'xl' : 'default'} onClick={() => onOpenChange(false)}>
          {t('ok')}
        </Button>
      }
    >
      <Notice
        tone="warning"
        appearance="callout"
        icon={<UsersIcon />}
        title={t('reason', { count: others })}
        text={t('text')}
      />
    </AdaptiveDialog>
  );
}
