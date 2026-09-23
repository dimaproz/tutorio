'use client';

import { useRef, useState } from 'react';
import { PencilIcon, PlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Spinner } from '@/components/ui/spinner';
import { Textarea } from '@/components/ui/textarea';

/**
 * A record's free-text notes, edited where they are read: the tinted notes
 * card of a profile. The card stays visible when empty so there is somewhere
 * obvious to put the first note. The caller saves and owns every word; the
 * editor closes only once `onSave` reports success.
 */
export function NotesCard({
  notes,
  updatedLabel,
  labels,
  maxLength,
  readOnly = false,
  pending = false,
  onSave,
}: {
  notes: string | null;
  /** e.g. "Updated 9 Sep". */
  updatedLabel?: string;
  labels: {
    title: string;
    edit: string;
    add: string;
    empty: string;
    placeholder: string;
    save: string;
    cancel: string;
  };
  maxLength: number;
  readOnly?: boolean;
  pending?: boolean;
  /** Saves the trimmed text, or null to clear it; resolves true on success. */
  onSave: (notes: string | null) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(notes ?? '');
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Save and Cancel disappear with the editor while one of them has focus;
  // the title is there in every state, so focus returns to it.
  const stopEditing = () => {
    setEditing(false);
    requestAnimationFrame(() => titleRef.current?.focus());
  };

  const startEditing = () => {
    setDraft(notes ?? '');
    setEditing(true);
  };

  const save = async () => {
    const trimmed = draft.trim();
    if (await onSave(trimmed.length > 0 ? trimmed : null)) stopEditing();
  };

  return (
    <Card tone="warning" data-slot="notes-card" className="gap-2.5 px-6 py-5.5">
      <div className="flex min-h-8 items-center justify-between gap-3">
        <h2 ref={titleRef} tabIndex={-1} className="text-base font-semibold outline-none">
          {labels.title}
        </h2>
        {!readOnly && !editing && notes ? (
          <Button
            type="button"
            variant="translucent"
            size="icon-xs"
            className="max-md:size-11"
            aria-label={labels.edit}
            onClick={startEditing}
          >
            <PencilIcon />
          </Button>
        ) : null}
      </div>

      {editing ? (
        <div className="flex flex-col gap-3">
          <Textarea
            autoFocus
            rows={5}
            maxLength={maxLength}
            aria-label={labels.title}
            placeholder={labels.placeholder}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="bg-card"
          />
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" disabled={pending} onClick={() => void save()}>
              {pending ? <Spinner data-icon="inline-start" /> : null}
              {labels.save}
            </Button>
            <Button
              type="button"
              variant="white"
              size="sm"
              disabled={pending}
              onClick={stopEditing}
            >
              {labels.cancel}
            </Button>
          </div>
        </div>
      ) : notes ? (
        <>
          <p className="text-sm leading-[22px] whitespace-pre-wrap">{notes}</p>
          {updatedLabel ? (
            <p className="text-xs text-tint-warning-foreground">{updatedLabel}</p>
          ) : null}
        </>
      ) : (
        <>
          <p className="text-sm leading-5 text-muted-foreground">{labels.empty}</p>
          {!readOnly ? (
            <div>
              <Button
                type="button"
                variant="white"
                size="xs"
                className="max-md:h-11"
                onClick={startEditing}
              >
                <PlusIcon data-icon="inline-start" />
                {labels.add}
              </Button>
            </div>
          ) : null}
        </>
      )}
    </Card>
  );
}
