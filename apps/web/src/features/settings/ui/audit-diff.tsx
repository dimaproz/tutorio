'use client';

import { ArrowRightIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { AuditLogListItem } from '@tutorio/validation';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { cn } from '@/lib/utils';
import { isEmptyValue, visibleFields } from '../model/audit';
import type { AuditField, useAuditFormat } from './use-audit-format';

type Format = ReturnType<typeof useAuditFormat>;

/** One value: a colour as its swatch and hex, an avatar as itself, else words. */
function AuditValue({
  item,
  field,
  side,
  format,
}: {
  item: AuditLogListItem;
  field: AuditField;
  side: 'before' | 'after';
  format: Format;
}) {
  const value = field[side];
  const text = format.valueText(item, field, value, side);
  if (!isEmptyValue(value) && field.spec.kind === 'color') {
    return (
      <span className="inline-flex items-center gap-2">
        <span
          aria-hidden="true"
          // A teacher's calendar colour is user data: shown as it is.
          style={{ backgroundColor: String(value) }}
          className="size-3.5 shrink-0 rounded-pill"
        />
        {text}
      </span>
    );
  }
  if (!isEmptyValue(value) && field.spec.kind === 'avatar') {
    return (
      <EntityAvatar avatarKey={String(value)} fullName={item.record.label ?? text} size="xs" />
    );
  }
  return <>{text}</>;
}

/** The old value: struck through and muted, but still read. */
function Before({ children, empty }: { children: React.ReactNode; empty: boolean }) {
  return (
    <span className={cn('text-muted-foreground', !empty && 'line-through decoration-1')}>
      {children}
    </span>
  );
}

/**
 * What changed in one row (S10 board 04-02): «Поле / Було / Стало» on
 * desktop; on phones each field as «було» over «→ стало». Long text wraps.
 */
export function AuditDiff({
  item,
  format,
  compact,
}: {
  item: AuditLogListItem;
  format: Format;
  compact: boolean;
}) {
  const t = useTranslations('settings.audit.diff');
  const fields = visibleFields(item);

  if (compact) {
    return (
      <dl className="flex flex-col rounded-tile bg-background px-3.5 py-1">
        {fields.map((field) => (
          <div
            key={field.key}
            className="flex flex-col gap-1 border-b border-border py-3 text-sm leading-5 last:border-b-0"
          >
            <dt className="text-xs leading-4 font-bold text-muted-foreground">
              {format.fieldLabel(field)}
            </dt>
            <dd className="break-words">
              <Before empty={isEmptyValue(field.before)}>
                <AuditValue item={item} field={field} side="before" format={format} />
              </Before>
            </dd>
            <dd className="flex items-start gap-2 break-words">
              <ArrowRightIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-brand" />
              <span className="sr-only">{t('afterShort')}</span>
              <AuditValue item={item} field={field} side="after" format={format} />
            </dd>
          </div>
        ))}
      </dl>
    );
  }

  return (
    <table className="w-full table-fixed border-collapse text-[15px] leading-6">
      <colgroup>
        <col className="w-50" />
        <col />
        <col />
      </colgroup>
      <thead>
        <tr className="border-b border-border text-left text-xs leading-4 font-bold tracking-[0.06em] text-muted-foreground uppercase">
          <th scope="col" className="px-5 py-3 font-bold">
            {t('field')}
          </th>
          <th scope="col" className="px-5 py-3 font-bold">
            {t('before')}
          </th>
          <th scope="col" className="px-5 py-3 font-bold">
            {t('after')}
          </th>
        </tr>
      </thead>
      <tbody>
        {fields.map((field) => (
          <tr key={field.key} className="border-b border-border align-top last:border-b-0">
            <th scope="row" className="px-5 py-3.5 text-left font-normal">
              {format.fieldLabel(field)}
            </th>
            <td className="px-5 py-3.5 break-words">
              <Before empty={isEmptyValue(field.before)}>
                <AuditValue item={item} field={field} side="before" format={format} />
              </Before>
            </td>
            <td className="px-5 py-3.5 break-words">
              <AuditValue item={item} field={field} side="after" format={format} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
