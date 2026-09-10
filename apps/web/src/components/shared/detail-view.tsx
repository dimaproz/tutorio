import { CalendarDaysIcon } from 'lucide-react';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { Badge } from '@/components/ui/badge';
import { CardTitle } from '@/components/ui/card';
import { Item, ItemContent, ItemDescription, ItemMedia, ItemTitle } from '@/components/ui/item';

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

export function SectionTitle({
  icon: Icon,
  children,
}: {
  icon: IconType;
  children: React.ReactNode;
}) {
  return (
    <CardTitle className="flex items-center gap-2.5 text-base">
      <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
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
      className="truncate font-medium text-foreground transition-colors hover:text-primary"
      href={href}
      target={external ? '_blank' : undefined}
      rel={external ? 'noopener noreferrer' : undefined}
    >
      {children}
    </a>
  ) : (
    <span className="truncate font-medium text-foreground">{children}</span>
  );
  return (
    <Item variant="outline">
      <ItemMedia variant="icon" className={accent ? 'bg-success/10 text-success' : undefined}>
        <Icon aria-hidden="true" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle className="font-normal text-muted-foreground">{label}</ItemTitle>
        <ItemDescription className="[&>a]:no-underline [&>a:hover]:no-underline">
          {value}
        </ItemDescription>
      </ItemContent>
    </Item>
  );
}

// Small pill used in a profile header for level / age / grade.
export function ProfileTag({
  icon: Icon,
  children,
}: {
  icon?: IconType;
  children: React.ReactNode;
}) {
  return (
    <Badge variant="secondary">
      {Icon ? <Icon data-icon="inline-start" /> : null}
      {children}
    </Badge>
  );
}
