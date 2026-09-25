'use client';

import { useMemo, useState } from 'react';
import type { PackageResponse, ScheduleResponse, SellToMembersDto } from '@tutorio/validation';
import { useNow, useTranslations } from 'next-intl';
import { FormProvider, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { BandWindow, BandWindowLayout } from '@/components/shared/band-window';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useIsMobile } from '@/hooks/use-mobile';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useMemberSalePreviewQuery, useSellToMembersMutation } from '../../api';
import { dayKey, isDayKey, startOfDay } from '../../model/dates';
import {
  appliedPrices,
  defaultSelection,
  memberLine,
  memberPreviewDto,
  memberSaleDefaults,
  memberSaleDto,
  ownRateHint,
  type MemberSaleCandidate,
} from '../../model/member-sale';
import { linkedPrice, saleFormSchema, saleLessons, type SaleFormValues } from '../../model/sale';
import { FooterNote, useErrorToast, usePackageForm } from '../form-parts';
import { usePackageFormat } from '../use-package-format';
import { MemberPicker, type MemberPickerRow } from './member-picker';
import { MemberSaleBand, type MemberSaleGroup } from './member-sale-band';
import { MembersSoldDialog } from './members-sold-dialog';
import { SaleKindField, SalePriceFields, SaleSizeFields } from './sale-fields';

/**
 * «Продати пакет учасникам» (S08 board 02, L-86): one package spec from the
 * S07 sale — the kind, its size and «Ціна для всіх» — sold to the members
 * ticked on the right, those who need one ticked by default (decision 10).
 * The per-member preview (`POST /packages/members/preview`) says what each
 * is sold, the lessons on debt it closes first and a pause that holds it
 * back; an own rate is a hint applied only on a click (decision 8). The sale
 * is all or nothing (decision 9) and ends on «Продано».
 */
export function MemberSaleDialog({
  open,
  onOpenChange,
  group,
  candidates,
  schedule,
  nowMs,
  onSold,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: MemberSaleGroup;
  /** The live members, in the roster's order. */
  candidates: MemberSaleCandidate[];
  schedule: ScheduleResponse | null;
  nowMs?: number;
  onSold?: (packages: PackageResponse[]) => void;
}) {
  return open ? (
    <MemberSaleFlow
      group={group}
      candidates={candidates}
      schedule={schedule}
      nowMs={nowMs}
      onSold={onSold}
      onClose={() => onOpenChange(false)}
    />
  ) : null;
}

function MemberSaleFlow({
  group,
  candidates,
  schedule,
  nowMs,
  onSold,
  onClose,
}: {
  group: MemberSaleGroup;
  candidates: MemberSaleCandidate[];
  schedule: ScheduleResponse | null;
  nowMs?: number;
  onSold?: (packages: PackageResponse[]) => void;
  onClose: () => void;
}) {
  const t = useTranslations('packages.memberSale');
  const tSale = useTranslations('packages.sale');
  const mobile = useIsMobile();
  const format = usePackageFormat();
  const clock = useNow();
  const [now] = useState(() => (nowMs ? new Date(nowMs) : clock));
  const timeZone = useStudioTimeZone();
  const today = dayKey(now, timeZone);
  const [picked, setPicked] = useState<ReadonlySet<string>>(
    () => new Set(defaultSelection(candidates)),
  );
  const [applied, setApplied] = useState<ReadonlySet<string>>(new Set());
  const [sold, setSold] = useState<PackageResponse[] | null>(null);
  const form = usePackageForm<SaleFormValues>(
    saleFormSchema(today),
    memberSaleDefaults(now, timeZone, {
      hasSchedule: schedule !== null,
      rateMinor: group.priceMinor,
    }),
  );
  const values = useWatch({ control: form.control }) as SaleFormValues;
  const currency = group.currency;

  // Every member is previewed, so a tick shows its line at once.
  const previewDto = memberPreviewDto(
    values,
    { groupId: group.id, candidates, applied, currency },
    today,
    timeZone,
  );
  const previewKey = useDebouncedValue(previewDto ? JSON.stringify(previewDto) : null);
  const preview = useMemberSalePreviewQuery(
    useMemo(() => (previewKey ? (JSON.parse(previewKey) as SellToMembersDto) : null), [previewKey]),
  );
  const shown = previewDto ? preview.data : undefined;
  const previewOf = new Map(shown?.items.map((item) => [item.studentId, item]));
  const first = shown?.items[0];
  const lessons = saleLessons(
    values,
    {
      scheduleLessons: first?.scheduleLessons ?? null,
      previewLessons: first?.lessonsTotal ?? null,
    },
    timeZone,
  );
  const price = linkedPrice(values, lessons);

  const rows: MemberPickerRow[] = candidates.map((candidate) => {
    const isApplied = applied.has(candidate.studentId);
    const item = previewOf.get(candidate.studentId);
    return {
      candidate,
      picked: picked.has(candidate.studentId),
      applied: isApplied,
      preview: item,
      line: memberLine(candidate, {
        preview: item,
        lessons,
        sharedPerLessonMinor: price.perLessonMinor,
        sharedTotalMinor: values.priceSource === 'total' ? price.totalMinor : null,
        applied: isApplied,
      }),
      ownHint: ownRateHint(candidate, {
        lessons,
        sharedPerLessonMinor: price.perLessonMinor,
        applied: isApplied,
      }),
    };
  });
  const selling = rows.filter((row) => row.picked && row.line);
  const count = selling.length;
  const totalMinor = selling.reduce((sum, row) => sum + (row.line?.totalMinor ?? 0), 0);
  const windowText =
    values.kind === 'FIXED_COUNT'
      ? values.until
        ? tSale('preview.until', { date: format.shortDay(startOfDay(values.until, timeZone)) })
        : tSale('preview.noEnd')
      : isDayKey(values.from) && isDayKey(values.to)
        ? format.shortRange(startOfDay(values.from, timeZone), startOfDay(values.to, timeZone))
        : '';
  const sizes = new Set(selling.map((row) => row.line?.lessons));
  const size =
    sizes.size === 1 && selling[0]?.line ? t('each', { count: selling[0].line.lessons }) : null;
  const totalLine =
    count > 0 ? [t('packages', { count }), size, windowText].filter(Boolean).join(' · ') : null;
  const amount = format.money(totalMinor, currency);
  // The package's name unless the tutor typed one: the group and the size.
  const suggestedName =
    values.kind === 'FIXED_COUNT'
      ? tSale('name.count', { name: group.name, count: lessons ?? 0 })
      : windowText
        ? tSale('name.period', { name: group.name, range: windowText })
        : group.name;

  const sell = useSellToMembersMutation();
  const showError = useErrorToast();
  const submit = form.handleSubmit((submitted) => {
    const studentIds = candidates
      .filter((candidate) => picked.has(candidate.studentId))
      .map((candidate) => candidate.studentId);
    if (studentIds.length === 0) return;
    sell.mutate(
      memberSaleDto(
        submitted,
        {
          groupId: group.id,
          studentIds,
          prices: appliedPrices(candidates, applied, studentIds),
          currency,
        },
        timeZone,
        suggestedName,
      ),
      {
        onSuccess: (result) => {
          onSold?.(result.items);
          setSold(result.items);
        },
        // All or nothing: the dialog stays as it was, nothing was sold.
        onError: showError,
      },
    );
  });

  const toggle = (studentId: string, next: boolean) =>
    setPicked((current) => {
      const updated = new Set(current);
      if (next) updated.add(studentId);
      else updated.delete(studentId);
      return updated;
    });
  const markApplied = (studentId: string, next: boolean) =>
    setApplied((current) => {
      const updated = new Set(current);
      if (next) updated.add(studentId);
      else updated.delete(studentId);
      return updated;
    });

  if (sold) {
    return (
      <MembersSoldDialog
        packages={sold}
        groupName={group.name}
        avatars={new Map(candidates.map((candidate) => [candidate.studentId, candidate.avatarKey]))}
        mobile={mobile}
        onClose={onClose}
      />
    );
  }

  return (
    <FormProvider {...form}>
      <BandWindow
        open
        onOpenChange={(next) => (next ? undefined : onClose())}
        description={t('description')}
        mobile={mobile}
        size="xl"
      >
        <form
          noValidate
          className="flex min-h-0 flex-1 flex-col"
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <BandWindowLayout
            mobile={mobile}
            band={
              <MemberSaleBand
                group={group}
                schedule={schedule}
                members={candidates.length}
                mobile={mobile}
                onClose={onClose}
              />
            }
            footerNote={
              mobile ? (
                totalLine ? (
                  <span>
                    <span className="mr-2 text-lg font-semibold text-foreground tabular-nums">
                      {amount}
                    </span>
                    {[t('packages', { count }), size].filter(Boolean).join(' · ')}
                  </span>
                ) : null
              ) : (
                <FooterNote>{t('footer')}</FooterNote>
              )
            }
            footer={
              <>
                <Button type="button" variant="outline" onClick={onClose}>
                  {t('cancel')}
                </Button>
                <Button type="submit" disabled={count === 0 || sell.isPending}>
                  {sell.isPending ? <Spinner data-icon="inline-start" /> : null}
                  {count === 0
                    ? t('submitNone')
                    : mobile
                      ? t('submitShort', { count })
                      : t('submit', { count, total: amount })}
                </Button>
              </>
            }
          >
            <div className="grid gap-7 md:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
              <div className="flex min-w-0 flex-col gap-5.5">
                <SaleKindField />
                <SaleSizeFields
                  schedule={schedule}
                  scheduleLessons={first?.scheduleLessons ?? null}
                  format={format}
                />
                <SalePriceFields
                  rate={
                    group.priceMinor !== null ? { rateMinor: group.priceMinor, currency } : null
                  }
                  lessons={lessons}
                  format={format}
                  label={t('priceLabel')}
                  rateHint={t('rateHint')}
                />
              </div>
              <MemberPicker
                rows={rows}
                currency={currency}
                onToggle={toggle}
                onToggleAll={(next) =>
                  setPicked(new Set(next ? candidates.map((candidate) => candidate.studentId) : []))
                }
                onApply={(studentId) => {
                  markApplied(studentId, true);
                  toggle(studentId, true);
                }}
                onReset={(studentId) => markApplied(studentId, false)}
                total={totalLine ? { line: totalLine, amount } : null}
              />
            </div>
          </BandWindowLayout>
        </form>
      </BandWindow>
    </FormProvider>
  );
}
