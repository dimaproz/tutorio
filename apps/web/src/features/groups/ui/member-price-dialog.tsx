'use client';

import { useState } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import { BanknoteIcon, CalendarClockIcon, RotateCcwIcon, UsersIcon } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import type { GroupDetail, GroupEnrollmentSummary } from '@tutorio/validation';
import { AdaptiveDialog } from '@/components/shared/adaptive-dialog';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { FieldNote } from '@/components/shared/field-note';
import { Notice } from '@/components/shared/notice';
import { PriceField } from '@/components/shared/price-field';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  memberPriceDefaults,
  memberPriceDto,
  memberPriceFormSchema,
  priceDifference,
  type MemberPriceFormValues,
} from '@/features/groups/model/member-price';
import { useIsMobile } from '@/hooks/use-mobile';
import { useUpdateEnrollmentMutation } from '@/lib/api/enrollments';
import { errorMessageKey } from '@/lib/api/error-message';
import { makeZodErrorMap } from '@/lib/forms/error-map';
import { useDateFormatters } from '@/lib/i18n/format';
import { formatMoneyCompact } from '@/lib/money';
import { useGroupMoney } from './member-price';

/**
 * «Ціна для учня» (L-11): a member's own price in the group, against the group
 * price. A 480px dialog on desktop, a bottom sheet on phones. Saving the group
 * price, or «Повернути ціну групи», makes the member follow the group again.
 * The new price applies from the next lesson: a charge keeps the amount it was
 * made with (L-12). After saving, a toast offers to undo.
 */
export function MemberPriceDialog({
  group,
  member,
  onOpenChange,
  onSaved,
}: {
  group: GroupDetail;
  /** The member whose price is edited; null closes the dialog. */
  member: GroupEnrollmentSummary | null;
  onOpenChange: (open: boolean) => void;
  /** The saved row, so the roster can mark it. */
  onSaved?: (enrollmentId: string) => void;
}) {
  return (
    <>
      {member ? (
        <MemberPriceForm
          key={member.id}
          group={group}
          member={member}
          onOpenChange={onOpenChange}
          onSaved={onSaved}
        />
      ) : null}
    </>
  );
}

function MemberPriceForm({
  group,
  member,
  onOpenChange,
  onSaved,
}: {
  group: GroupDetail;
  member: GroupEnrollmentSummary;
  onOpenChange: (open: boolean) => void;
  onSaved?: (enrollmentId: string) => void;
}) {
  const t = useTranslations('groups.memberPrice');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const tErrors = useTranslations('errors');
  const tValidation = useTranslations('validation');
  const mobile = useIsMobile();
  const money = useGroupMoney();
  const dates = useDateFormatters();
  const update = useUpdateEnrollmentMutation();
  const [open, setOpen] = useState(true);
  const currency = group.currency ?? member.currency;
  const groupPrice = group.pricePerLesson;
  const form = useForm<MemberPriceFormValues>({
    resolver: zodResolver(memberPriceFormSchema, {
      errorMap: makeZodErrorMap(tValidation),
      path: [],
      async: true,
    }),
    defaultValues: memberPriceDefaults(member),
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });
  const price = useWatch({ control: form.control, name: 'price' });
  const saving = update.isPending;
  const difference = priceDifference(price, groupPrice);
  const sign = formatMoneyCompact(0, currency, locale).symbol;
  const name = member.student.fullName;
  const next = group.nextLesson?.startsAtUtc ?? null;

  const close = () => {
    setOpen(false);
    onOpenChange(false);
  };

  const save = async (priceMinor: number) => {
    const previous = member.priceMinor;
    await update.mutateAsync({
      enrollmentId: member.id,
      dto: { priceMinor, currency: currency as MemberPriceDtoCurrency },
    });
    close();
    onSaved?.(member.id);
    const follows = groupPrice !== null && priceMinor === groupPrice;
    toast.success(
      follows
        ? t('savedGroup', { name })
        : t('savedOwn', { name, price: money(priceMinor, currency) }),
      {
        action: {
          label: t('undo'),
          onClick: () =>
            update.mutate({
              enrollmentId: member.id,
              dto: { priceMinor: previous, currency: currency as MemberPriceDtoCurrency },
            }),
        },
      },
    );
  };

  const submit = form.handleSubmit(async (values) => {
    try {
      await save(memberPriceDto(values, currency).priceMinor ?? 0);
    } catch {
      // The request error shows above the actions.
    }
  });

  const revert = async () => {
    if (groupPrice === null) return;
    try {
      await save(groupPrice);
    } catch {
      // As above.
    }
  };

  const hint =
    difference === null || difference.kind === 'same'
      ? groupPrice !== null && difference?.kind === 'same'
        ? t('sameAsGroup')
        : undefined
      : t(difference.kind === 'less' ? 'lessThanGroup' : 'moreThanGroup', {
          amount: money(difference.amountMinor, currency),
        });

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={(next) => (next ? undefined : saving ? undefined : close())}
      eyebrow={t('eyebrow')}
      title={name}
      description={
        <span className="inline-flex items-center gap-1.5 [&_svg]:size-3.5">
          <UsersIcon aria-hidden="true" />
          {group.name}
        </span>
      }
      icon={
        <EntityAvatar
          avatarKey={member.student.avatarKey}
          fullName={name}
          tint="indigo"
          className="size-11"
        />
      }
      closeLabel={t('close')}
      initialFocus="member-price-field"
      primary={
        <Button
          type="submit"
          form="member-price-form"
          disabled={saving}
          size={mobile ? 'xl' : 'default'}
        >
          {saving ? <Spinner data-icon="inline-start" /> : null}
          {saving ? t('saving') : t('save')}
        </Button>
      }
      secondary={
        <Button
          type="button"
          variant="outline"
          disabled={saving}
          size={mobile ? 'xl' : 'default'}
          onClick={close}
        >
          {tCommon('cancel')}
        </Button>
      }
      tertiary={
        member.ownPrice && groupPrice !== null ? (
          <Button type="button" variant="ghost" disabled={saving} onClick={() => void revert()}>
            <RotateCcwIcon data-icon="inline-start" />
            {t('revert')}
          </Button>
        ) : undefined
      }
    >
      <form
        id="member-price-form"
        noValidate
        className="flex flex-col gap-4"
        onSubmit={(event) => void submit(event)}
      >
        {groupPrice !== null ? (
          <div className="flex items-center gap-2.5 rounded-tile bg-background px-4 py-3.5 text-sm leading-5">
            <BanknoteIcon aria-hidden="true" className="text-muted-foreground" />
            <span className="text-muted-foreground">{t('groupPrice')}</span>
            <span className="ml-auto text-muted-foreground">
              {t.rich('perLesson', {
                price: money(groupPrice, currency),
                b: (chunks) => <b className="text-base font-semibold text-foreground">{chunks}</b>,
              })}
            </span>
          </div>
        ) : null}
        <Controller
          control={form.control}
          name="price"
          render={({ field, fieldState }) => (
            <PriceField
              id="member-price-field"
              name={field.name}
              label={t('ownPrice')}
              value={field.value}
              onChange={field.onChange}
              onBlur={field.onBlur}
              currency={sign}
              disabled={saving}
              autoFocus
              hint={fieldState.error ? undefined : hint}
              error={fieldState.error?.message}
            />
          )}
        />
        <FieldNote tone="muted" icon={<CalendarClockIcon />}>
          {t.rich(next ? 'fromNextOn' : 'fromNext', {
            date: next ? dates.weekdayDayMonth(next) : '',
            b: (chunks) => <b className="font-semibold text-foreground">{chunks}</b>,
          })}
        </FieldNote>
        {update.isError ? (
          <Notice tone="danger" text={tErrors(errorMessageKey(update.error))} />
        ) : null}
      </form>
    </AdaptiveDialog>
  );
}

type MemberPriceDtoCurrency = ReturnType<typeof memberPriceDto>['currency'];
