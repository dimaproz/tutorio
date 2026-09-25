'use client';

import {
  BanknoteIcon,
  LayersIcon,
  PackagePlusIcon,
  RepeatIcon,
  UsersIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScheduleResponse } from '@tutorio/validation';
import { DialogTitle } from '@/components/ui/dialog';
import { IconButton } from '@/components/shared/icon-button';
import { BandHeader, TintBand } from '@/components/shared/tint-band';
import { WhoCard, WhoChip } from '@/components/shared/who-picker';
import { usePackageFormat } from '../use-package-format';

/** The group a sale to members is made for. */
export type MemberSaleGroup = {
  id: string;
  name: string;
  teacherName: string;
  /** The group price per lesson; null when it has none. */
  priceMinor: number | null;
  currency: string;
};

/**
 * The band of «Продати пакет учасникам» (S08 board 02): the title with the
 * line that the sale records no payment (L-87), and the group card — the
 * group, its teacher, its week, its price and how many members it has.
 */
export function MemberSaleBand({
  group,
  schedule,
  members,
  mobile,
  onClose,
}: {
  group: MemberSaleGroup;
  schedule: ScheduleResponse | null;
  members: number;
  mobile: boolean;
  onClose: () => void;
}) {
  const t = useTranslations('packages.memberSale');
  const tSale = useTranslations('packages.sale');
  const format = usePackageFormat();
  return (
    <TintBand className={mobile ? 'gap-4 px-4 pt-4 pb-4.5' : undefined}>
      <BandHeader
        icon={<PackagePlusIcon />}
        title={
          <DialogTitle className="text-xl leading-[26px] font-semibold tracking-[-0.01em]">
            {t('title')}
          </DialogTitle>
        }
        subtitle={t('subtitle')}
        actions={
          <IconButton
            icon={<XIcon />}
            label={t('close')}
            size={38}
            tone="surface"
            onClick={onClose}
          />
        }
      />
      <WhoCard
        media={
          <span
            aria-hidden="true"
            className="flex size-11 items-center justify-center rounded-item bg-tint-indigo text-brand md:size-14 md:rounded-tile [&_svg]:size-5 md:[&_svg]:size-6"
          >
            <LayersIcon />
          </span>
        }
        name={group.name}
        meta={t('group', { teacher: group.teacherName })}
        chips={
          <>
            <WhoChip icon={<RepeatIcon />}>
              {schedule ? format.scheduleDays(schedule) : tSale('noSchedule')}
            </WhoChip>
            {group.priceMinor !== null ? (
              <WhoChip icon={<BanknoteIcon />}>
                {tSale('rate', { price: format.money(group.priceMinor, group.currency) })}
              </WhoChip>
            ) : null}
            {mobile ? null : (
              <WhoChip icon={<UsersIcon />}>{t('members', { count: members })}</WhoChip>
            )}
          </>
        }
      />
    </TintBand>
  );
}
