'use client';

import type { ReactNode } from 'react';
import {
  BanknoteIcon,
  CircleAlertIcon,
  PackagePlusIcon,
  PlayIcon,
  WalletCardsIcon,
} from 'lucide-react';
import { useFormatter, useTranslations } from 'next-intl';
import type { MemberBillingState } from '@/features/packages';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CreditMeter } from '@/components/shared/credit-meter';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { PersonItem } from '@/components/shared/person-item';
import { cn } from '@/lib/utils';
import { useGroupMoney } from './member-price';

/** The contextual command of a member card (S08 decision 3). */
export type MemberAction = 'pay' | 'sell' | 'return';

const BADGE: Record<
  MemberBillingState['kind'],
  'danger' | 'warning' | 'secondary' | 'success' | 'neutral'
> = {
  debt: 'danger',
  low: 'warning',
  partial: 'warning',
  unpaid: 'warning',
  noPackage: 'secondary',
  paid: 'success',
  paused: 'neutral',
};

/**
 * The command a standing asks for: a payment for a debt or a package part
 * paid, a package when it runs low or is missing, the return from a pause;
 * none when all is well. Lessons held on debt in package mode are closed by
 * the next package (L-82), so they ask for one.
 */
export function memberAction(state: MemberBillingState): MemberAction | null {
  switch (state.kind) {
    case 'debt':
      return state.debt?.source === 'credits' ? 'sell' : 'pay';
    case 'partial':
    case 'unpaid':
      return 'pay';
    case 'low':
    case 'noPackage':
      return 'sell';
    case 'paused':
      return 'return';
    case 'paid':
      return null;
  }
}

/** The last day a package with this exclusive end pays for. */
const lastDay = (expiresAt: string) => new Date(Date.parse(expiresAt) - 1);

/**
 * One member of «Склад групи» (S08 variant C): the avatar, the name, the meta
 * («B2 · 400 ₴», an own price in 600 with «своя ціна»), the standing as a
 * badge and the ⋯; then the credits (`CreditMeter`, grey while paused) or a
 * line, and the contextual outline command — never a dark button. On phones
 * the badge joins the second row and the command takes the full width.
 */
export function GroupMemberCard({
  name,
  avatarKey,
  href,
  hrefLabel,
  meta,
  state,
  menu,
  onAction,
  highlighted = false,
  compact,
}: {
  name: string;
  avatarKey: string | null;
  href: string;
  hrefLabel: string;
  meta: ReactNode;
  /** Null while the members' billing loads or cannot be read. */
  state: MemberBillingState | null;
  menu: ReactNode;
  onAction?: (action: MemberAction) => void;
  highlighted?: boolean;
  compact: boolean;
}) {
  const t = useTranslations('groups.roster');
  const format = useFormatter();
  const money = useGroupMoney();
  const shortDay = (value: Date) => format.dateTime(value, { day: 'numeric', month: 'short' });

  const badge = state ? (
    <Badge variant={BADGE[state.kind]} className="shrink-0">
      {state.kind === 'debt' && state.debt
        ? t('badge.debt', { amount: money(state.debt.minor, state.currency) })
        : t(`badge.${state.kind}`)}
    </Badge>
  ) : null;

  let standing: ReactNode = null;
  if (state) {
    const pkg = state.pkg;
    if (state.kind === 'debt' && state.debt) {
      standing = (
        <Line tone="danger" icon={<CircleAlertIcon />}>
          {state.debt.source === 'credits'
            ? t('lineDebtCredits', { count: state.debt.lessons })
            : t('lineDebtBalance', { count: state.debt.lessons })}
        </Line>
      );
    } else if (pkg && state.kind !== 'noPackage') {
      const caption =
        state.kind === 'paused'
          ? state.pausedUntil
            ? t('meterPaused', {
                left: pkg.left,
                total: pkg.total,
                date: shortDay(lastDay(state.pausedUntil)),
              })
            : t('meterPausedOpen', { left: pkg.left, total: pkg.total })
          : state.kind === 'partial'
            ? t('meterPaid', {
                left: pkg.left,
                total: pkg.total,
                amount: money(pkg.paidMinor, state.currency),
              })
            : state.kind === 'unpaid'
              ? t('meterUnpaid', { left: pkg.left, total: pkg.total })
              : pkg.expiresAt
                ? t('meterUntil', {
                    left: pkg.left,
                    total: pkg.total,
                    date: shortDay(lastDay(pkg.expiresAt)),
                  })
                : t('meterNoEnd', { left: pkg.left, total: pkg.total });
      standing = (
        <CreditMeter
          left={pkg.left}
          total={pkg.total}
          // Only «Закінчується» reads as running low; the studio threshold decided it.
          lowThreshold={state.kind === 'low' ? pkg.total : -1}
          tone={state.kind === 'paused' ? 'paused' : 'default'}
          label={caption}
        />
      );
    } else if (state.kind === 'paused') {
      standing = (
        <Line tone="muted" icon={<WalletCardsIcon />}>
          {state.pausedUntil
            ? t('linePaused', { date: shortDay(lastDay(state.pausedUntil)) })
            : t('linePausedOpen')}
        </Line>
      );
    } else {
      standing = (
        <Line tone="muted" icon={<WalletCardsIcon />}>
          {state.billingType === 'PER_LESSON' ? t('linePerLesson') : t('lineNoCredits')}
        </Line>
      );
    }
  }

  const action = state && onAction ? memberAction(state) : null;
  const command = action ? (
    <Button
      type="button"
      variant="outline"
      size="xs"
      className={cn('shrink-0', compact && 'h-10 w-full')}
      aria-label={`${t(ACTION_LABEL[action])} · ${name}`}
      onClick={() => onAction?.(action)}
    >
      {ACTION_ICON[action]}
      {t(ACTION_LABEL[action])}
    </Button>
  ) : null;

  return (
    <div
      data-slot="group-member-card"
      className={cn(
        'flex flex-col gap-3 rounded-block bg-background px-4 py-3.5',
        highlighted &&
          'bg-tint-indigo shadow-[inset_0_0_0_1px_var(--border)] transition-colors duration-700',
      )}
    >
      <PersonItem
        href={href}
        hrefLabel={hrefLabel}
        media={<EntityAvatar avatarKey={avatarKey} fullName={name} size="md" />}
        name={name}
        subtitle={meta}
        action={compact ? undefined : badge}
        menu={menu}
        className="mx-0 w-full p-0 hover:bg-transparent hover:shadow-none has-[a:focus-visible]:bg-transparent"
      />
      {standing || command || (compact && badge) ? (
        compact ? (
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">{standing}</div>
              {badge}
            </div>
            {command}
          </div>
        ) : (
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">{standing}</div>
            {command}
          </div>
        )
      ) : null}
    </div>
  );
}

const ACTION_LABEL = { pay: 'actionPay', sell: 'actionSell', return: 'actionReturn' } as const;

const ACTION_ICON: Record<MemberAction, ReactNode> = {
  pay: <BanknoteIcon data-icon="inline-start" />,
  sell: <PackagePlusIcon data-icon="inline-start" />,
  return: <PlayIcon data-icon="inline-start" />,
};

/** A member's standing as an icon and a line (13 px, 15 px icon). */
function Line({
  tone,
  icon,
  children,
}: {
  tone: 'danger' | 'muted';
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        'flex items-center gap-2 text-[13px] leading-[18px] [&_svg]:size-[15px] [&_svg]:shrink-0',
        tone === 'danger' ? 'text-tint-danger-foreground' : 'text-muted-foreground',
      )}
    >
      {icon}
      {children}
    </span>
  );
}
