'use client';

import { useId } from 'react';
import { CheckIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { FieldDescription, FieldLabel } from '@/components/ui/field';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { inkOn } from '@/lib/theme/user-colors';
import { cn } from '@/lib/utils';
import { TEACHER_COLORS } from '../model/presentation';
import { teacherStyle } from './teacher-art';

/** A preview lesson: the teacher's name, their first subject (if any) and colour. */
export type ColorPreviewEntry = { name: string; subject: string | undefined; color: string };

function PreviewBlock({ entry }: { entry: ColorPreviewEntry }) {
  const t = useTranslations('teachers.form');
  return (
    <div
      style={teacherStyle(entry.color)}
      className="flex min-w-0 flex-col gap-0.5 rounded-row border-l-[3px] border-(--teacher) bg-[color-mix(in_oklab,var(--teacher)_16%,var(--card))] px-3 py-2"
    >
      <span className="truncate text-[13px] font-semibold">{entry.name}</span>
      <span className="truncate font-mono text-xs text-muted-foreground">
        {entry.subject ? t('previewLesson', { subject: entry.subject }) : t('previewTime')}
      </span>
    </div>
  );
}

/**
 * «Колір у календарі» (S09 board 03): ten swatches, the chosen one ringed
 * with ✓, the colours other teachers have marked with a dot, and «Так у
 * календарі» — this teacher's lesson beside another teacher's.
 */
export function ColorField({
  value,
  onChange,
  used,
  self,
  other,
  disabled = false,
}: {
  value: string;
  onChange: (color: string) => void;
  /** Colours other active teachers use, upper-case. */
  used: ReadonlySet<string>;
  self: ColorPreviewEntry;
  /** Another teacher for the preview, when there is one. */
  other?: ColorPreviewEntry;
  disabled?: boolean;
}) {
  const t = useTranslations('teachers.form');
  const id = useId();

  return (
    <div role="group" aria-labelledby={`${id}-label`} className="flex flex-col gap-2.5">
      <FieldLabel id={`${id}-label`}>{t('color')}</FieldLabel>
      <ToggleGroup
        type="single"
        value={value.toUpperCase()}
        onValueChange={(next) => next && onChange(next)}
        disabled={disabled}
        aria-labelledby={`${id}-label`}
        className="flex flex-wrap gap-2.5"
      >
        {TEACHER_COLORS.map((color, index) => {
          const taken = used.has(color);
          const chosen = value.toUpperCase() === color;
          return (
            <ToggleGroupItem
              key={color}
              value={color}
              aria-label={
                taken
                  ? t('colorUsed', { index: index + 1 })
                  : t('colorOption', { index: index + 1 })
              }
              style={{ ...teacherStyle(color), color: inkOn(color) }}
              className={cn(
                'relative size-10 min-w-10 rounded-pill bg-(--teacher) p-0 hover:bg-(--teacher) data-[state=on]:bg-(--teacher)',
                chosen && 'ring-2 ring-(--teacher) ring-offset-[3px] ring-offset-card',
              )}
            >
              {chosen ? <CheckIcon aria-hidden="true" className="size-4" /> : null}
              {taken ? (
                <span
                  aria-hidden="true"
                  className="absolute -right-0.5 -bottom-0.5 flex size-4 items-center justify-center rounded-pill bg-card"
                >
                  <span className="size-2 rounded-pill bg-muted-foreground" />
                </span>
              ) : null}
            </ToggleGroupItem>
          );
        })}
      </ToggleGroup>
      <div className="flex flex-col gap-2 rounded-tile bg-background p-3">
        <span className="text-xs font-semibold tracking-[0.06em] text-muted-foreground uppercase">
          {t('colorPreview')}
        </span>
        <div className="grid gap-2 sm:grid-cols-2">
          <PreviewBlock entry={{ ...self, color: value }} />
          {other ? <PreviewBlock entry={other} /> : null}
        </div>
      </div>
      <FieldDescription className="text-[13px]">{t('colorHint')}</FieldDescription>
    </div>
  );
}
