import type { ReactNode } from 'react';
import { CheckIcon, XIcon } from 'lucide-react';
import { IconButton } from '@/components/shared/icon-button';

export type SetupChecklistItem = {
  id: string;
  icon: ReactNode;
  title: ReactNode;
  description: ReactNode;
  /** The row's command, typically an outline `xs` button. */
  action: ReactNode;
};

/**
 * The "choose your next step" panel on a freshly created record: a success
 * mark, a heading, independent next actions and a dismiss control. It owns no
 * state; dismissing is the caller's decision.
 */
export function SetupChecklist({
  title,
  text,
  items,
  onDismiss,
  dismissLabel,
}: {
  title: ReactNode;
  text?: ReactNode;
  items: SetupChecklistItem[];
  onDismiss?: () => void;
  dismissLabel: string;
}) {
  return (
    <section
      data-slot="setup-checklist"
      className="flex flex-col gap-4 rounded-card bg-tint-sky p-5.5 text-tint-foreground"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <span
            aria-hidden="true"
            className="flex size-10 shrink-0 items-center justify-center rounded-pill bg-success text-success-foreground"
          >
            <CheckIcon className="size-5" strokeWidth={2.5} />
          </span>
          <div className="flex flex-col gap-0.5">
            <h2 className="text-lg leading-6 font-semibold">{title}</h2>
            {text ? <p className="text-[13px] leading-[18px] text-tint-sky-muted">{text}</p> : null}
          </div>
        </div>
        {onDismiss ? (
          <IconButton
            size={36}
            tone="translucent"
            icon={<XIcon />}
            label={dismissLabel}
            onClick={onDismiss}
          />
        ) : null}
      </div>
      <ul className="flex flex-col gap-2">
        {items.map((item) => (
          <li
            key={item.id}
            className="flex flex-wrap items-center gap-3.5 rounded-tile bg-card px-3.5 py-3 text-foreground sm:flex-nowrap"
          >
            <span
              aria-hidden="true"
              className="flex size-10 shrink-0 items-center justify-center rounded-control bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-5"
            >
              {item.icon}
            </span>
            <div className="flex min-w-0 grow basis-40 flex-col gap-0.5">
              <span className="text-sm leading-[19px] font-semibold">{item.title}</span>
              <span className="text-[13px] leading-[18px] text-muted-foreground">
                {item.description}
              </span>
            </div>
            {item.action}
          </li>
        ))}
      </ul>
    </section>
  );
}
