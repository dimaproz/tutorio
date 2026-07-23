import { CalendarDaysIcon } from 'lucide-react';
import { EntityAvatar } from '@/components/app/entity-avatar';
import { sectionToneClass, type SectionTone } from '@/components/app/section-tone';
import { CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

type IconType = React.ComponentType<{ className?: string }>;

// Profile header shared by the student and parent detail pages. Sits directly
// on the page background (no card) with a ringed avatar, name, an optional
// status badge, optional tag pills, and an optional subtitle line (e.g. the
// "added on" date).
export function ProfileHeader({
  avatarKey,
  fullName,
  badge,
  tags,
  subtitle,
}: {
  avatarKey?: string | null;
  fullName: string;
  badge?: React.ReactNode;
  tags?: React.ReactNode;
  subtitle?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <EntityAvatar avatarKey={avatarKey} fullName={fullName} size="xl" ring className="shrink-0" />
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{fullName}</h1>
          {badge}
        </div>
        {tags ? <div className="flex flex-wrap gap-2">{tags}</div> : null}
        {subtitle ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDaysIcon className="size-3.5" />
            {subtitle}
          </p>
        ) : null}
      </div>
    </div>
  );
}

// A card header title with a tinted icon square — the TailAdmin section voice.
// `tone` colours the square; it defaults to neutral so existing callers keep
// their grey square until they opt into a colour.
export function SectionTitle({
  icon: Icon,
  tone = 'neutral',
  children,
}: {
  icon: IconType;
  tone?: SectionTone;
  children: React.ReactNode;
}) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-base">
      <span
        className={cn(
          'grid size-8 shrink-0 place-items-center rounded-lg',
          sectionToneClass[tone],
        )}
      >
        <Icon className="size-4" />
      </span>
      {children}
    </CardTitle>
  );
}

// A labelled value row with a leading icon square. `accent` swaps the neutral
// square for a green "money" wash (used for the hourly rate).
export function InfoRow({
  icon: Icon,
  label,
  children,
  href,
  external,
  accent,
}: {
  icon: IconType;
  label: string;
  children: React.ReactNode;
  href?: string;
  external?: boolean;
  accent?: boolean;
}) {
  const value = href ? (
    <a
      className="truncate text-sm font-medium underline-offset-4 transition-colors hover:text-primary hover:underline"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ) : (
    <span className="truncate text-sm font-medium">{children}</span>
  );
  return (
    <div className="flex items-center gap-3 rounded-xl border p-3">
      <span
        className="grid size-10 shrink-0 place-items-center rounded-lg bg-muted text-muted-foreground"
        style={
          accent
            ? { backgroundColor: 'var(--status-paid-wash)', color: 'var(--status-paid)' }
            : undefined
        }
      >
        <Icon className="size-5" />
      </span>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs text-muted-foreground">{label}</span>
        {value}
      </div>
    </div>
  );
}

// Small pill used in a profile header for subject / level / age / grade.
export function ProfileTag({ icon: Icon, children }: { icon?: IconType; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {Icon ? <Icon className="size-3.5" /> : null}
      {children}
    </span>
  );
}
