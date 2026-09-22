'use client';

import { CheckIcon, MoreHorizontalIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { buttonVariants } from '@/components/ui/button';
import { CreditMeter } from '@/components/shared/credit-meter';
import { DateTile } from '@/components/shared/date-tile';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { LessonItem } from '@/components/shared/lesson-item';
import { NextLessonCard } from '@/components/shared/next-lesson-card';
import { PersonItem } from '@/components/shared/person-item';
import { SectionDivider } from '@/components/shared/section-divider';
import { StatBlock } from '@/components/shared/stat-block';
import { cn } from '@/lib/utils';

// The collages are a picture of the product, not the product: they are inert
// and hidden from assistive technology, and their sample copy is localized
// illustration rather than anyone's data.

const PAID_BARS = [3, 4, 3, 5, 4, 6, 5, 7];

function FakeButton({ variant, children }: { variant: 'soft' | 'dark-outline'; children: string }) {
  return <span className={buttonVariants({ variant })}>{children}</span>;
}

export function AuthPromoLogin() {
  const t = useTranslations('auth.promo.sample');

  return (
    <div inert className="flex w-full max-w-160 flex-col gap-4">
      <div className="flex w-full max-w-117.5 flex-col gap-1 rounded-block bg-card px-3 pt-3 pb-2 text-foreground">
        <div className="px-2.5 pt-1 pb-1.5">
          <SectionDivider label={t('today')} />
        </div>
        <LessonItem
          state="next"
          date={{ top: t('thu'), day: '11' }}
          title={t('lesson1')}
          meta={t('lesson1Meta')}
          status={<Badge variant="brand">{t('next')}</Badge>}
          actions={<MoreHorizontalIcon className="size-5 text-muted-foreground" />}
        />
        <LessonItem
          date={{ top: t('thu'), day: '11' }}
          title={t('lesson2')}
          meta={t('lesson2Meta')}
          status={<Badge variant="info">{t('scheduled')}</Badge>}
          actions={<MoreHorizontalIcon className="size-5 text-muted-foreground" />}
        />
      </div>
      <div className="grid grid-cols-[minmax(0,340px)_minmax(0,284px)] items-end gap-4">
        <div className="min-w-0">
          <NextLessonCard
            className="md:h-75"
            heading={t('nextLesson')}
            relative={t('inTwoDays')}
            date={t('nextDate')}
            time={t('nextTime')}
            teacher={
              <PersonItem
                tone="ink"
                size="sm"
                media={<EntityAvatar avatarKey="user-2" fullName="D T" size="sm" />}
                name={t('teacher')}
                subtitle={t('teacherSub')}
              />
            }
            primaryAction={<FakeButton variant="soft">{t('open')}</FakeButton>}
            secondaryAction={<FakeButton variant="dark-outline">{t('reschedule')}</FakeButton>}
          />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <StatBlock
            type="chart"
            chart="bars"
            label={t('paidMonth')}
            value={t('paidValue')}
            data={PAID_BARS}
            badge={{ label: '+12%', tone: 'success' }}
            caption={t('payments')}
          />
          <div className="flex flex-col gap-3 rounded-block bg-card p-4 text-foreground">
            <PersonItem
              media={<EntityAvatar avatarKey="user-1" fullName="A S" />}
              name={t('student1')}
              subtitle={t('student1Sub')}
            />
            <CreditMeter left={6} total={8} label={t('creditsLeft', { left: 6, total: 8 })} />
          </div>
        </div>
      </div>
    </div>
  );
}

const STUDENTS = [
  { key: 'user-1', name: 'student1', sub: 'student1Sub', left: 6, total: 8 },
  { key: 'user-4', name: 'student2', sub: 'student2Sub', left: 1, total: 8 },
  { key: 'user-2', name: 'student3', sub: 'student3Sub', left: 6, total: 10 },
] as const;

const WEEK = [
  ['mon', '08'],
  ['tue', '09'],
  ['wed', '10'],
  ['thu', '11'],
  ['fri', '12'],
] as const;

export function AuthPromoRegister() {
  const t = useTranslations('auth.promo.sample');

  return (
    // A capped grid, not absolute positions: the blocks keep their rhythm on
    // any panel width, and longer translations push content down instead of
    // running into the next block.
    <div
      inert
      className="grid w-full max-w-160 grid-cols-[minmax(0,1fr)_minmax(0,236px)] items-start gap-4"
    >
      <div className="flex min-w-0 flex-col gap-4">
        <div className="flex flex-col gap-0.5 rounded-block bg-card px-2.5 pt-3.5 pb-2.5 text-foreground">
          <div className="flex items-center justify-between px-2.5 pt-0.5 pb-2">
            <span className="text-[15px] leading-5 font-semibold">{t('students')}</span>
            <span className="font-mono text-xs text-muted-foreground">48</span>
          </div>
          {STUDENTS.map((student) => (
            <div
              key={student.key}
              className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-field px-2.5 py-2 [&_[data-slot=credit-meter]>span]:whitespace-nowrap"
            >
              <PersonItem
                size="sm"
                media={<EntityAvatar avatarKey={student.key} fullName="S" size="sm" />}
                name={t(student.name)}
                subtitle={t(student.sub)}
              />
              <CreditMeter
                left={student.left}
                total={student.total}
                label={t('creditsLeft', { left: student.left, total: student.total })}
              />
            </div>
          ))}
        </div>
        <div className="flex w-fit max-w-full flex-col gap-3 rounded-block bg-card px-4.5 py-4 text-foreground">
          <span className="text-xs leading-4 font-medium tracking-[0.04em] text-muted-foreground uppercase">
            {t('week')}
          </span>
          <div className="flex gap-2">
            {WEEK.map(([day, date]) => (
              <DateTile
                key={day}
                top={t(day)}
                day={date}
                size={52}
                state={day === 'thu' ? 'highlighted' : 'default'}
              />
            ))}
          </div>
        </div>
      </div>
      <div className="min-w-0 pt-10">
        <StatBlock
          type="chart"
          chart="ring"
          tone="ink"
          label={t('credits')}
          value={t('creditsValue')}
          percent={75}
          caption={t('package')}
          detail={t('used')}
        />
      </div>
      <div className="col-span-2 flex w-full max-w-105 flex-col gap-1 justify-self-end rounded-card bg-card p-4.5 text-foreground shadow-popover">
        <div className="flex items-center justify-between px-3 pt-1 pb-2.5">
          <span className="text-base leading-6 font-semibold">{t('gettingStarted')}</span>
          <Badge variant="success">{t('stepsDone')}</Badge>
        </div>
        {(['step1', 'step2', 'step3'] as const).map((step, index) => (
          <div
            key={step}
            className={cn(
              'flex items-start gap-3.5 rounded-tile p-3',
              index === 1 && 'bg-surface-hover',
            )}
          >
            <span
              className={cn(
                'flex size-8 shrink-0 items-center justify-center rounded-pill font-mono text-[13px] font-medium',
                index === 0 && 'bg-success text-white',
                index === 1 && 'bg-primary text-primary-foreground',
                index === 2 && 'bg-background text-muted-foreground',
              )}
            >
              {index === 0 ? <CheckIcon className="size-4" strokeWidth={2.5} /> : index + 1}
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-[15px] leading-5 font-semibold">{t(`${step}.title`)}</span>
              <span className="text-[13px] leading-[18px] text-muted-foreground">
                {t(`${step}.text`)}
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
