'use client';

import type { ReactNode } from 'react';
import { BanknoteIcon, CircleSlashIcon, LayersIcon, PlayIcon, RepeatIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { ScheduleResponse } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import {
  cancellationHours,
  directionName,
  type PassView,
} from '@/features/students/model/learning';
import { cn } from '@/lib/utils';
import { PassStub } from './pass-stub';
import type { LearningFormat } from './use-learning-format';

/**
 * One direction of the student as a pass (S06 decision 1): the stub with
 * what the direction has, a perforation, and the body — who teaches it, its
 * schedule, its price and its cancellation window, the next step and the ⋯
 * menu. On phones the stub sits above the body and the perforation runs
 * across the card.
 */
export function DirectionPass({
  view,
  schedule,
  studioDeadlineHours,
  format,
  menu,
  onPay,
  onReturn,
  pending = false,
}: {
  view: PassView;
  schedule: ScheduleResponse | null;
  studioDeadlineHours: number;
  format: LearningFormat;
  /** The direction's ⋯ menu; omitted on a read-only profile. */
  menu?: ReactNode;
  onPay?: () => void;
  onReturn?: () => void;
  pending?: boolean;
}) {
  const t = useTranslations('students.learningBlock');
  const { direction, current } = view;
  const packageMode = direction.billingType === 'PACKAGE';
  const name = directionName(direction);
  const title = packageMode
    ? current
      ? t('titlePackage', { name, package: current.name ?? t('packageUnnamed') })
      : t('titleNoPackage', { name })
    : t('titlePerLesson', { name });
  const subtitle = direction.group
    ? t('subtitleGroup', { teacher: direction.teacher.name })
    : t('subtitleIndividual', { teacher: direction.teacher.name });
  const deadline = cancellationHours(direction, studioDeadlineHours);
  const rate = format.money(direction.rateMinor, direction.currency);
  const partial = packageMode && current && view.packageOwedMinor > 0;
  const paused = view.state === 'paused';

  const action =
    view.action === 'pay' && onPay ? (
      <Button
        type="button"
        size="sm"
        variant={view.actionPrimary ? 'default' : 'outline'}
        onClick={onPay}
      >
        <BanknoteIcon data-icon="inline-start" />
        {t('pay')}
      </Button>
    ) : view.action === 'return' && onReturn ? (
      <Button type="button" size="sm" variant="outline" disabled={pending} onClick={onReturn}>
        <PlayIcon data-icon="inline-start" />
        {t('return')}
      </Button>
    ) : null;

  return (
    <article
      aria-label={title}
      className="flex flex-col overflow-hidden rounded-block bg-card md:flex-row md:overflow-visible"
    >
      <PassStub view={view} format={format} className="md:w-72.5 md:shrink-0 md:rounded-l-block" />
      <Perforation />
      <div className="flex min-w-0 grow flex-col justify-center gap-4 px-4 py-4 md:py-4.5 md:pr-5 md:pl-6">
        <div className="flex items-center gap-3">
          {direction.group ? (
            <span
              aria-hidden="true"
              className="flex size-9 shrink-0 items-center justify-center rounded-control bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4.5"
            >
              <LayersIcon />
            </span>
          ) : (
            <EntityAvatar
              avatarKey={direction.teacher.avatarKey}
              fullName={direction.teacher.name}
              size="sm"
            />
          )}
          <div className="flex min-w-0 grow flex-col">
            <h3 className="truncate text-[15px] leading-5 font-semibold">{title}</h3>
            <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
              {subtitle}
            </span>
          </div>
          {action ? <div className="hidden shrink-0 md:flex">{action}</div> : null}
          {menu}
        </div>
        <ul className={cn('grid gap-3 md:grid-cols-3 md:gap-4', paused && 'text-muted-foreground')}>
          <Fact
            icon={<RepeatIcon />}
            title={schedule ? format.scheduleDays(schedule) : t('noSchedule')}
            text={schedule ? format.scheduleDetail(schedule) : t('noScheduleText')}
          />
          <Fact
            icon={<BanknoteIcon />}
            title={
              partial ? (
                <span className="text-tint-warning-foreground">
                  {t('paidOf', { paid: format.money(current.paidMinor, direction.currency) })}
                </span>
              ) : packageMode && current ? (
                t('perPackage', {
                  price: format.money(current.totalPriceMinor, direction.currency),
                })
              ) : (
                t('perLesson', { price: rate })
              )
            }
            text={
              partial
                ? t('paidOfText', {
                    total: format.money(current.totalPriceMinor, direction.currency),
                    left: format.money(view.packageOwedMinor, direction.currency),
                  })
                : packageMode && current
                  ? t('perPackageText', { count: current.lessonsTotal, price: rate })
                  : packageMode
                    ? t('rateForNew')
                    : t('perLessonText')
            }
          />
          <Fact
            icon={<CircleSlashIcon />}
            title={
              deadline.hours === 0
                ? t('cancelUntilStart')
                : t('cancelHours', { hours: deadline.hours })
            }
            text={t('cancelLater')}
          />
        </ul>
        {action ? <div className="flex md:hidden">{action}</div> : null}
      </div>
    </article>
  );
}

function Fact({ icon, title, text }: { icon: ReactNode; title: ReactNode; text: ReactNode }) {
  return (
    <li className="flex items-start gap-2.5">
      <span
        aria-hidden="true"
        data-fact-icon
        className="mt-px flex text-muted-foreground [&_svg]:size-4"
      >
        {icon}
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="text-sm leading-5 font-semibold">{title}</span>
        <span className="text-xs leading-4 text-muted-foreground">{text}</span>
      </span>
    </li>
  );
}

/**
 * The tear line between the stub and the body: a 2px dashed rule with a
 * notch cut in the page colour at each end. Vertical on desktop, across the
 * card on phones.
 */
function Perforation() {
  return (
    <div
      aria-hidden="true"
      className="relative shrink-0 border-t-2 border-dashed border-border md:w-0 md:border-t-0 md:border-l-2"
    >
      <span className="absolute top-[-11px] -left-2.5 size-5 rounded-pill bg-background md:top-[-10px] md:left-[-11px]" />
      <span className="absolute top-[-11px] -right-2.5 size-5 rounded-pill bg-background md:top-auto md:right-auto md:bottom-[-10px] md:left-[-11px]" />
    </div>
  );
}
