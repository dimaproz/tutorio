'use client';

import { useMemo } from 'react';
import { useLocale, useNow, useTranslations } from 'next-intl';
import type { AuditEntityDto, AuditLogListItem } from '@tutorio/validation';
import { addCalendarDays, dayStartIso, zonedDate } from '@/lib/datetime';
import { useLocalFormatter } from '@/lib/i18n/local-formatter';
import { useStudioTimeZone } from '@/lib/i18n/time-zone';
import { useWeekdayLabels } from '@/lib/i18n/weekdays';
import { formatMoneyCompact } from '@/lib/money';
import { capitalizeFirst } from '@/lib/utils';
import {
  heldAutomatically,
  isEmptyValue,
  moneyCurrency,
  summaryFields,
  visibleFields,
  type FieldSpec,
} from '../model/audit';

export type AuditField = ReturnType<typeof visibleFields>[number];
type Side = 'before' | 'after';
type Slot = { weekday: number; localTime: string };

/** The kinds a new record's summary names by value («Новий учень · 500 ₴ · A1»). */
const CREATE_FACTS = new Set<FieldSpec['kind']>(['money', 'enum', 'lessons', 'weeks', 'minutes']);

const isSlots = (value: unknown): value is Slot[] =>
  Array.isArray(value) &&
  value.every((slot) => typeof slot === 'object' && slot !== null && 'weekday' in slot);

/**
 * How the log reads (S10 board 04): a record's name with what tells it
 * apart, a field's label, a value in plain words — money from minor units in
 * the record's currency, dates on the studio's clock, ids as names, empty as
 * «—» — and the one-line summary of a row.
 */
export function useAuditFormat(names: Record<string, string>) {
  const t = useTranslations('settings.audit');
  const tUnits = useTranslations('settings.units');
  const locale = useLocale();
  const format = useLocalFormatter();
  const timeZone = useStudioTimeZone();
  const weekdays = useWeekdayLabels('short');
  const now = useNow();

  return useMemo(() => {
    const none = t('none');
    const dayMonth = (day: string) =>
      format.dateTime(new Date(dayStartIso(day, timeZone)), { day: 'numeric', month: 'long' });
    const slots = (value: Slot[]) => {
      const times = [...new Set(value.map((slot) => slot.localTime))];
      const days = value.map((slot) => capitalizeFirst(weekdays[slot.weekday] ?? ''));
      return times.length === 1
        ? `${format.list(days, { type: 'conjunction' })} ${times[0]}`
        : value
            .map((slot) => `${capitalizeFirst(weekdays[slot.weekday] ?? '')} ${slot.localTime}`)
            .join(', ');
    };
    const thisYear = zonedDate(now, timeZone).slice(0, 4);
    /** «1 жовт.», with the year only when it is not this one. */
    const shortDate = (iso: string) =>
      format.dateTime(new Date(iso), {
        day: 'numeric',
        month: 'short',
        ...(zonedDate(iso, timeZone).slice(0, 4) === thisYear ? {} : { year: 'numeric' }),
      });
    const money = (amount: number, currency: string | null) =>
      currency ? formatMoneyCompact(amount, currency, locale).text : format.number(amount / 100);

    /** One value as text; «—» for nothing. */
    const valueText = (
      item: Pick<AuditLogListItem, 'changes' | 'record'>,
      field: Pick<AuditField, 'spec'>,
      value: unknown,
      side: Side,
    ): string => {
      if (isEmptyValue(value)) return none;
      const spec: FieldSpec = field.spec;
      switch (spec.kind) {
        case 'money':
          return typeof value === 'number'
            ? money(value, moneyCurrency(item, side))
            : String(value);
        case 'datetime':
          return format.dateTime(new Date(String(value)), {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          });
        case 'date':
          return shortDate(String(value));
        case 'ref':
          return names[String(value)] ?? none;
        case 'refs': {
          const list = (value as unknown[]).map((id) => names[String(id)]).filter(Boolean);
          return list.length ? list.join(', ') : none;
        }
        case 'list': {
          const list = (value as unknown[]).map((entry) =>
            spec.values && t.has(`values.${spec.values}.${String(entry)}`)
              ? t(`values.${spec.values}.${String(entry)}`)
              : String(entry),
          );
          return list.join(', ');
        }
        case 'enum': {
          const key = `values.${spec.values}.${String(value)}`;
          return t.has(key) ? t(key) : String(value);
        }
        case 'bool':
          return value ? t('yes') : t('no');
        case 'hours':
          return tUnits('hours', { count: Number(value) });
        case 'weeks':
          return tUnits('weeks', { count: Number(value) });
        case 'lessons':
          return tUnits('lessons', { count: Number(value) });
        case 'minutes':
          return tUnits('minutes', { count: Number(value) });
        case 'count':
          return format.number(Number(value));
        case 'slots':
          return isSlots(value) ? slots(value) : String(value);
        case 'color':
          return String(value).toUpperCase();
        default:
          return typeof value === 'object' ? JSON.stringify(value) : String(value);
      }
    };

    const fieldLabel = (field: Pick<AuditField, 'spec'>) =>
      t.has(`fields.${field.spec.label}`) ? t(`fields.${field.spec.label}`) : field.spec.label;

    const entity = (value: AuditEntityDto) => t(`entity.${value}`);

    /** «Maksym Tkachenko · ср 9 вер 16:30», «Kids A2 · Вт і Чт 15:00». */
    const recordTitle = (item: AuditLogListItem) => {
      const { record } = item;
      const label = record.label ?? t('deletedRecord');
      const extra = record.startsAt
        ? format.dateTime(new Date(record.startsAt), {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
          })
        : record.amountMinor !== null
          ? money(record.amountMinor, record.currency)
          : record.slots?.length
            ? slots(record.slots)
            : item.entity === 'ENROLLMENT'
              ? record.detail
              : null;
      return extra ? `${label} · ${extra}` : label;
    };

    /** The one-line summary of a row (S10 board 04). */
    const summary = (item: AuditLogListItem) => {
      if (
        item.entity === 'PAYMENT' &&
        item.action === 'CREATE' &&
        item.record.amountMinor !== null
      ) {
        const amount = money(item.record.amountMinor, item.record.currency);
        // «Переказ 3 200 ₴»: how it was paid, when the entry records it.
        const paid = item.changes?.fields.method?.after;
        const method = t.has(`summary.method.${String(paid)}`)
          ? t(`summary.method.${String(paid)}`)
          : t('summary.method.OTHER');
        return item.record.detail
          ? t('summary.paymentFor', { method, amount, name: item.record.detail })
          : t('summary.payment', { method, amount });
      }
      const change = item.changes?.fields;
      if (
        item.entity === 'SCHEDULE' &&
        isSlots(change?.slots?.before) &&
        isSlots(change?.slots?.after) &&
        typeof change?.effectiveFrom?.after === 'string'
      ) {
        // «Зміна з 1 жовт.: Чт 15:00 → Чт 16:00»: only the days that moved.
        const before = change.slots.before;
        const after = change.slots.after;
        const same = (a: Slot, b: Slot) => a.weekday === b.weekday && a.localTime === b.localTime;
        const gone = before.filter((slot) => !after.some((next) => same(slot, next)));
        const added = after.filter((slot) => !before.some((last) => same(slot, last)));
        return t('summary.scheduleChange', {
          date: shortDate(change.effectiveFrom.after),
          before: gone.length ? slots(gone) : none,
          after: added.length ? slots(added) : none,
        });
      }
      if (item.action === 'CREATE') {
        // A new record reads by its kind and two telling facts, not a list of labels.
        const facts = visibleFields(item)
          .filter(
            (field) =>
              CREATE_FACTS.has(field.spec.kind) &&
              field.key !== 'status' &&
              !isEmptyValue(field.after),
          )
          .slice(0, 2)
          .map((field) => valueText(item, field, field.after, 'after'));
        return [t(`summary.created.${item.entity}`), ...facts].join(' · ');
      }
      const { fields, more } = summaryFields(item);
      const parts = fields.map((field, index) => {
        const label = fieldLabel(field);
        const named = index === 0 ? label : label.toLocaleLowerCase(locale);
        if (!field.withValues) return named;
        const after = valueText(item, field, field.after, 'after');
        if (isEmptyValue(field.before)) return t('summary.set', { label: named, value: after });
        const before = valueText(item, field, field.before, 'before');
        return `${named} ${t('summary.arrow', { before, after })}`;
      });
      const lead =
        item.action === 'DELETE'
          ? t('summary.deleted')
          : item.action === 'RESTORE'
            ? t('summary.restored')
            : null;
      const text = [lead, parts.length ? parts.join(', ') + (more ? t('summary.more') : '') : null]
        .filter(Boolean)
        .join(' · ');
      const suffix = heldAutomatically(item) ? ` ${t('summary.automatic')}` : '';
      return (text || t('summary.nothing')) + suffix;
    };

    const today = zonedDate(now, timeZone);
    const dayLabel = (day: string) =>
      day === today
        ? t('today', { date: dayMonth(day) })
        : day === addCalendarDays(today, -1)
          ? t('yesterday', { date: dayMonth(day) })
          : dayMonth(day);

    return {
      valueText,
      fieldLabel,
      entity,
      recordTitle,
      summary,
      dayLabel,
      time: (iso: string) => format.time(new Date(iso)),
    };
  }, [t, tUnits, locale, format, timeZone, weekdays, now, names]);
}
