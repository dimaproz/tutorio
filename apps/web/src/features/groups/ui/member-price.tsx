'use client';

import { useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { formatMoneyCompact } from '@/lib/money';
import { cn } from '@/lib/utils';

/** A price as the roster writes it: «400 ₴». */
export function useGroupMoney() {
  const locale = useLocale();
  return (amountMinor: number, currency: string) =>
    formatMoneyCompact(amountMinor, currency, locale).text;
}

/**
 * «своя ціна»: the badge of a member who pays their own price. Its tooltip
 * names the group price — on hover and focus on desktop, on a tap on phones.
 */
export function OwnPriceBadge({ groupPrice }: { groupPrice: string | null }) {
  const t = useTranslations('groups.memberPrice');
  const [open, setOpen] = useState(false);
  if (groupPrice === null) {
    return (
      <Badge variant="indigo" size="sm">
        {t('ownBadge')}
      </Badge>
    );
  }
  return (
    <Tooltip open={open} onOpenChange={setOpen}>
      <TooltipTrigger asChild>
        <Badge variant="indigo" size="sm" asChild>
          <button type="button" onClick={() => setOpen(true)}>
            {t('ownBadge')}
          </button>
        </Badge>
      </TooltipTrigger>
      <TooltipContent>{t('groupPriceTooltip', { price: groupPrice })}</TooltipContent>
    </Tooltip>
  );
}

/**
 * The roster's price cell: the group price muted, an own price in 600 with
 * the badge under it. On phones the badge moves into the row's meta line.
 */
export function MemberPriceCell({
  price,
  own,
  groupPrice,
  withBadge,
}: {
  price: string;
  own: boolean;
  groupPrice: string | null;
  /** Desktop: the badge sits under the amount. */
  withBadge: boolean;
}) {
  return (
    <span className="flex flex-col items-end gap-1 text-right">
      <span
        className={cn(
          'text-sm leading-5 whitespace-nowrap tabular-nums',
          own ? 'font-semibold text-foreground' : 'text-muted-foreground',
        )}
      >
        {price}
      </span>
      {own && withBadge ? <OwnPriceBadge groupPrice={groupPrice} /> : null}
    </span>
  );
}
