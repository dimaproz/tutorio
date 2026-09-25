'use client';

import { PackageIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Controller, useFormContext, useWatch } from 'react-hook-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PriceField } from '@/components/shared/price-field';
import { formatPriceInput } from '@/lib/money';
import type { CreateFormValues } from '../../model/create';
import { priceInputFromMinor } from '../../model/fields';
import { useMoney, useMoneyParts } from '../lesson-format';
import type { CreateData } from './use-create-data';

/** A price in minor units as the field shows it: "500", or "500.50" with cents. */
export const priceText = (minor: number) => priceInputFromMinor(minor, formatPriceInput);

/**
 * The price of the lesson form (FieldsTeacher board) for what is picked: a
 * package credit with what is left after the new lessons (or the debt past
 * the last credit, L-82); the group price, locked (members pay their own
 * rate, L-11); the amount — the pair's rate, the substitute's with
 * «Оновлено», a typed one with «Повернути ставку»; or «—» until the pick.
 */
export function CreatePriceField({
  data,
  mobile,
  rate,
  currency,
  coverage,
  charged,
  updatedFrom,
  onTyped,
  studentName,
  teacherName,
}: {
  data: CreateData;
  mobile: boolean;
  /** The rate the price starts from, if anything is picked. */
  rate: number | null;
  currency: string;
  coverage: { covered: number; debt: number; leftAfter: number } | null;
  /** The lessons that are charged. */
  charged: number;
  /** The rate before the teacher changed, for «Оновлено». */
  updatedFrom: number | null;
  /** The tutor typed a price: «Оновлено» no longer applies. */
  onTyped: () => void;
  studentName: string;
  teacherName: string;
}) {
  const t = useTranslations('lessons.fields');
  const money = useMoney();
  const moneyParts = useMoneyParts();
  const form = useFormContext<CreateFormValues>();
  const [frequency, price] = useWatch({ control: form.control, name: ['frequency', 'price'] });
  const byHand = data.priceMode === 'amount' && rate !== null && price !== priceText(rate);

  const hint = (() => {
    if (data.priceMode === 'package' && data.credits) {
      if (frequency === 'weekly') {
        return data.credits.name
          ? t('pricePackageWeekly', { name: data.credits.name })
          : t('pricePackageWeeklyUnnamed');
      }
      const total = data.credits.total;
      if (!coverage) return undefined;
      if (coverage.covered === 0) return t('pricePackageDebt');
      if (coverage.debt > 0) return t('pricePackagePartial', { covered: coverage.covered });
      if (total === null) return undefined;
      return charged === 1
        ? t('pricePackageLeft', { left: coverage.leftAfter, total })
        : t('pricePackageLeftMany', { count: charged, left: coverage.leftAfter, total });
    }
    if (data.priceMode === 'group') {
      // A member with their own price pays it, not the group's (L-11).
      const own = data.group?.ownPrices ?? [];
      return own.length > 0
        ? t('priceGroupOwn', {
            members: own
              .map((item) =>
                t('priceGroupOwnMember', {
                  name: item.name,
                  price: money(item.priceMinor, item.currency),
                }),
              )
              .join(', '),
          })
        : t('priceGroup');
    }
    if (data.priceMode === 'none') return t('priceEmpty');
    if (rate === null) return undefined;
    if (byHand) return t('priceByHand', { rate: money(rate, currency) });
    if (updatedFrom !== null) {
      return t('priceUpdatedHint', {
        student: studentName,
        teacher: teacherName,
        was: money(updatedFrom, currency),
      });
    }
    if (data.solo) return t('priceSolo', { student: studentName });
    if (data.booking?.direction && !data.booking.substitute) {
      return t('priceOneOff', { student: studentName });
    }
    return t('priceRate', { student: studentName, teacher: teacherName });
  })();

  if (data.priceMode === 'package') {
    return (
      <PriceField
        label={t('price')}
        state="package"
        value=""
        currency=""
        packageLabel={
          mobile ? t('pricePackageShort', { count: 1 }) : t('pricePackage', { count: 1 })
        }
        packageIcon={<PackageIcon />}
        hint={hint}
      />
    );
  }
  if (data.priceMode === 'group') {
    return (
      <PriceField
        label={t('pricePerMember')}
        state="locked"
        value={data.group ? priceText(data.group.rateMinor) : ''}
        currency={moneyParts(0, currency).symbol}
        hint={hint}
      />
    );
  }
  return (
    <Controller
      control={form.control}
      name="price"
      render={({ field, fieldState }) => (
        <PriceField
          label={t('price')}
          state={data.priceMode === 'none' ? 'empty' : 'amount'}
          currency={moneyParts(0, currency).symbol}
          labelAction={
            byHand && rate !== null ? (
              <Button
                type="button"
                variant="link"
                size="xs"
                className="h-auto px-0 font-semibold"
                onClick={() => form.setValue('price', priceText(rate), { shouldDirty: true })}
              >
                {t('priceRestore')}
              </Button>
            ) : updatedFrom !== null ? (
              <Badge variant="info">{t('priceUpdated')}</Badge>
            ) : undefined
          }
          hint={hint}
          error={fieldState.error?.message}
          value={field.value}
          onChange={(next) => {
            onTyped();
            field.onChange(next);
          }}
          onBlur={field.onBlur}
          name={field.name}
        />
      )}
    />
  );
}
