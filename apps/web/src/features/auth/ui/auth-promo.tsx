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
    <div inert className="flex flex-col gap-4">
      <div className="flex w-117.5 flex-col gap-1 rounded-block bg-card px-3 pt-3 pb-2 text-foreground">
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
      <div className="flex items-end gap-4">
        <div className="w-85 shrink-0">
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
        <div className="flex w-71 flex-col gap-4">
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
    <div inert className="relative h-167.5">
      <div className="absolute top-0 left-0 flex w-97.5 flex-col gap-0.5 rounded-block bg-card px-2.5 pt-3.5 pb-2.5 text-foreground">
        <div className="flex items-center justify-between px-2.5 pt-0.5 pb-2">
          <span className="text-[15px] leading-5 font-semibold">{t('students')}</span>
          <span className="font-mono text-xs text-muted-foreground">48</span>
        </div>
        {STUDENTS.map((student) => (
          <div
            key={student.key}
            className="grid grid-cols-[minmax(0,1fr)_96px] items-center gap-3 rounded-field px-2.5 py-2"
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
      <div className="absolute top-10 right-0 w-59">
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
      <div className="absolute top-61 left-0 flex flex-col gap-3 rounded-block bg-card px-4.5 py-4 text-foreground">
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
      <div className="absolute right-0 bottom-0 flex w-105 flex-col gap-1 rounded-card bg-card p-4.5 text-foreground shadow-popover">
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
