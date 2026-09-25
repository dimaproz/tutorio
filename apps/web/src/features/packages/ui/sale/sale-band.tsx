'use client';

import { useState } from 'react';
import {
  BanknoteIcon,
  CheckIcon,
  LayersIcon,
  PackageIcon,
  PackagePlusIcon,
  RepeatIcon,
  UserRoundIcon,
  XIcon,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { DialogTitle } from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Skeleton } from '@/components/ui/skeleton';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { IconButton } from '@/components/shared/icon-button';
import { BandHeader, TintBand } from '@/components/shared/tint-band';
import { WhoCard, WhoChip, WhoEmptyCard, WhoSearch } from '@/components/shared/who-picker';
import { useStudentsQuery } from '../../api';
import { directionName } from '../../model/names';
import type { SaleData } from './use-sale-data';
import { usePackageFormat } from '../use-package-format';

/**
 * The sale's band (S07 board 01): «Новий пакет» with the line that selling
 * creates no schedule and records no payment (L-87), and the direction card
 * — the student and the direction, individual or group with the teacher,
 * its schedule, rate and current package — with «Інший напрям». On the
 * «Пакети» page the student is picked here first.
 */
export function SaleBand({
  data,
  mobile,
  canChangeStudent,
  onPickStudent,
  onPickDirection,
  onClose,
}: {
  data: SaleData;
  mobile: boolean;
  canChangeStudent: boolean;
  onPickStudent: (studentId: string | null) => void;
  onPickDirection: (enrollmentId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('packages.sale');
  const format = usePackageFormat();
  const [searching, setSearching] = useState(false);
  const { student, direction, directions, schedule, current } = data;

  const name = direction ? directionName(direction) : '';
  const subtitle = mobile && student && direction ? `${student.fullName} · ${name}` : t('subtitle');

  let body;
  if (searching || (!student && !data.loading && canChangeStudent)) {
    body = searching ? (
      <StudentSearch
        mobile={mobile}
        onPick={(id) => {
          setSearching(false);
          onPickStudent(id);
        }}
        onClose={() => setSearching(false)}
      />
    ) : (
      <WhoEmptyCard
        title={t('pickStudent')}
        hint={t('pickStudentHint')}
        onOpen={() => setSearching(true)}
      />
    );
  } else if (data.loading || !student) {
    body = <Skeleton className="h-24 w-full rounded-row bg-card" />;
  } else if (!direction) {
    body = (
      <WhoCard
        media={<EntityAvatar avatarKey={student.avatarKey} fullName={student.fullName} size="lg" />}
        name={student.fullName}
        meta={t('noDirections')}
        action={
          canChangeStudent ? (
            <Button type="button" variant="outline" size="sm" onClick={() => setSearching(true)}>
              {t('otherStudent')}
            </Button>
          ) : undefined
        }
      />
    );
  } else {
    const menu = (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant={mobile ? 'ghost' : 'outline'} size="sm">
            {mobile ? t('change') : t('otherDirection')}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72">
          {directions.map((row) => (
            <DropdownMenuItem
              key={row.enrollmentId}
              onSelect={() => onPickDirection(row.enrollmentId)}
            >
              {row.group ? <LayersIcon /> : <UserRoundIcon />}
              <span className="flex min-w-0 grow flex-col">
                <span className="truncate">{directionName(row)}</span>
                <span className="truncate text-xs text-muted-foreground">
                  {t('directionOption', {
                    teacher: row.teacher.name,
                    price: format.money(row.rateMinor, row.currency),
                  })}
                </span>
              </span>
              {row.enrollmentId === direction.enrollmentId ? <CheckIcon /> : null}
            </DropdownMenuItem>
          ))}
          {canChangeStudent ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setSearching(true)}>
                <UserRoundIcon />
                {t('otherStudent')}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    );
    const kind = direction.group
      ? t('group', { teacher: direction.teacher.name })
      : t('individual', { teacher: direction.teacher.name });
    body = (
      <WhoCard
        media={
          mobile ? (
            <EntityAvatar
              avatarKey={direction.teacher.avatarKey}
              fullName={direction.teacher.name}
              size="md"
            />
          ) : (
            <EntityAvatar avatarKey={student.avatarKey} fullName={student.fullName} size="lg" />
          )
        }
        name={mobile ? `${name} · ${direction.teacher.name}` : `${student.fullName} · ${name}`}
        meta={
          mobile
            ? [
                schedule ? format.scheduleDays(schedule) : null,
                t('rate', { price: format.money(direction.rateMinor, direction.currency) }),
              ]
                .filter(Boolean)
                .join(' · ')
            : kind
        }
        chips={
          mobile ? undefined : (
            <>
              {schedule ? (
                <WhoChip icon={<RepeatIcon />}>{format.scheduleDays(schedule)}</WhoChip>
              ) : (
                <WhoChip icon={<RepeatIcon />}>{t('noSchedule')}</WhoChip>
              )}
              <WhoChip icon={<BanknoteIcon />}>
                {t('rate', { price: format.money(direction.rateMinor, direction.currency) })}
              </WhoChip>
              {current ? (
                <WhoChip icon={<PackageIcon />}>
                  {t('current', {
                    left: Math.max(current.remainingCredits, 0),
                    total: current.lessonsTotal,
                  })}
                </WhoChip>
              ) : null}
            </>
          )
        }
        action={menu}
      />
    );
  }

  return (
    <TintBand className={mobile ? 'gap-4 px-4 pt-4 pb-4.5' : undefined}>
      <BandHeader
        icon={<PackagePlusIcon />}
        title={
          <DialogTitle className="text-xl leading-[26px] font-semibold tracking-[-0.01em]">
            {t('title')}
          </DialogTitle>
        }
        subtitle={subtitle}
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
      {body}
    </TintBand>
  );
}

/** The student search in the band: the studio's active students by name. */
function StudentSearch({
  mobile,
  onPick,
  onClose,
}: {
  mobile: boolean;
  onPick: (studentId: string) => void;
  onClose: () => void;
}) {
  const t = useTranslations('packages.sale.search');
  const [query, setQuery] = useState('');
  const students = useStudentsQuery({
    page: 1,
    pageSize: 20,
    search: query.trim() || undefined,
    state: 'active',
    sort: 'fullName',
  });
  return (
    <WhoSearch
      compact={mobile}
      query={query}
      onQueryChange={setQuery}
      loading={students.isFetching}
      items={(students.data?.items ?? []).map((student) => ({
        value: student.id,
        title: student.fullName,
        media: <EntityAvatar avatarKey={student.avatarKey} fullName={student.fullName} size="sm" />,
      }))}
      onSelect={onPick}
      onClose={onClose}
      labels={{
        placeholder: t('placeholder'),
        heading: t('heading'),
        clear: t('clear'),
        close: t('close'),
        escape: t('escape'),
        emptyTitle: t('emptyTitle'),
        emptyText: t('emptyText'),
      }}
    />
  );
}
