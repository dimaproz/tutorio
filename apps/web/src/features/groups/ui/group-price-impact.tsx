'use client';

import type { ReactNode } from 'react';
import { CalendarClockIcon, InfoIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormContext, useWatch } from 'react-hook-form';
import type { GroupEnrollmentSummary } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FieldNote } from '@/components/shared/field-note';
import { Badge } from '@/components/ui/badge';
import type { GroupFormValues } from '@/features/groups/model/form';
import { groupPriceImpact } from '@/features/groups/model/member-price';
import { useDateFormatters } from '@/lib/i18n/format';
import { useGroupMoney } from './member-price';

export type GroupPriceImpactSource = {
  members: readonly GroupEnrollmentSummary[];
  /** The price the form opened with. */
  initialPriceMinor: number | null;
  /** The group's next lesson, the first one a new price applies to. */
  nextLessonAt: string | null;
};

function Row({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2.5">
      <span aria-hidden="true" className="mt-0.5 flex shrink-0 text-brand [&_svg]:size-4">
        {icon}
      </span>
      <span className="min-w-0 grow">{children}</span>
    </div>
  );
}

/**
 * Under the group price (L-11). While the price is unchanged, a hint that a
 * member can have their own; once it changes, the sky block with who moves to
 * it, who keeps their own price (each listed) and that past lessons keep
 * theirs (L-12).
 */
export function GroupPriceImpact({ source }: { source?: GroupPriceImpactSource }) {
  const t = useTranslations('groups.form');
  const money = useGroupMoney();
  const dates = useDateFormatters();
  const { control } = useFormContext<GroupFormValues>();
  const [price, currency] = useWatch({ control, name: ['pricePerLesson', 'currency'] });
  const impact = source ? groupPriceImpact(source.members, source.initialPriceMinor, price) : null;

  if (!source || !impact) {
    return (
      <FieldNote icon={<InfoIcon />} className="col-span-2">
        {t('priceHint')}
      </FieldNote>
    );
  }

  const next = source.nextLessonAt;
  return (
    <div
      role="status"
      data-slot="group-price-impact"
      className="col-span-2 flex flex-col gap-2.5 rounded-tile bg-tint-sky px-3.5 py-3 text-sm leading-[19px] text-tint-foreground"
    >
      <Row icon={<InfoIcon />}>
        <b className="font-semibold">
          {t('priceImpactFollowing', { count: impact.following.length })}
        </b>
        {' · '}
        {impact.own.length > 0
          ? t('priceImpactOwn', { count: impact.own.length })
          : source.initialPriceMinor !== null
            ? `${money(source.initialPriceMinor, currency)} → ${money(impact.nextPriceMinor, currency)}`
            : money(impact.nextPriceMinor, currency)}
      </Row>
      {impact.own.length > 0 ? (
        <ul className="flex flex-col gap-1.5 pl-6.5">
          {impact.own.map((member) => (
            <li key={member.id} className="flex flex-wrap items-center gap-2">
              <EntityAvatar
                avatarKey={member.student.avatarKey}
                fullName={member.student.fullName}
                tint="indigo"
                className="size-6"
              />
              <span>{member.student.fullName}</span>
              <span className="text-tint-sky-muted">
                {t('priceImpactKeeps', { price: money(member.priceMinor, member.currency) })}
              </span>
              <Badge variant="indigo" size="sm">
                {t('ownPriceBadge')}
              </Badge>
            </li>
          ))}
        </ul>
      ) : null}
      <Row icon={<CalendarClockIcon />}>
        {next
          ? t('priceImpactFromNextOn', { date: dates.weekdayDayMonth(next) })
          : t('priceImpactFromNext')}
      </Row>
    </div>
  );
}
