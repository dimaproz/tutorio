import type { AvatarKeyDto } from '@tutorio/validation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, nameInitials } from '@/lib/utils';

// The single avatar used for every person in the product (students, parents,
// teachers). A picked illustration renders as an image; otherwise it falls back
// to initials. `ring` adds the legacy halo (a gap + soft outline) used on
// profile headers, and `ring="hero"` the thick surface ring the profile hero
// uses. `status` adds the lifecycle dot that list rows and the hero share.
const SIZE_CLASS = {
  xs: 'size-7',
  sm: 'size-9',
  md: 'size-11',
  lg: 'size-14',
  xl: 'size-20',
  '2xl': 'size-22 md:size-38',
} as const;

// The initials size has to travel to the fallback itself: AvatarFallback sets
// its own `text-sm`, which wins over anything inherited from the root.
const INITIALS_CLASS = {
  xs: 'text-xs',
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-base',
  xl: 'text-xl',
  '2xl': 'text-3xl md:text-5xl',
} as const;

const TINT_CLASS = {
  paper: 'bg-background text-muted-foreground',
  warning: 'bg-tint-warning text-tint-warning-foreground',
  indigo: 'bg-tint-indigo text-tint-indigo-foreground',
  // For a person sitting on an indigo surface, where the indigo tint would
  // paint the avatar the same colour as the card behind it.
  surface: 'bg-card text-tint-indigo-foreground',
} as const;

const STATUS_CLASS = {
  active: 'bg-status-active',
  hold: 'bg-status-hold',
  archived: 'bg-status-archived',
} as const;

export type EntityAvatarSize = keyof typeof SIZE_CLASS;
export type EntityAvatarTint = keyof typeof TINT_CLASS;
export type EntityAvatarStatus = keyof typeof STATUS_CLASS;

export function avatarSrc(avatarKey: AvatarKeyDto): string {
  return `/images/tailadmin/avatars/${avatarKey}.jpg`;
}

export function EntityAvatar({
  avatarKey,
  fullName,
  size = 'md',
  ring = false,
  tint = 'paper',
  status,
  statusLabel,
  className,
}: {
  avatarKey?: AvatarKeyDto | string | null;
  fullName: string;
  size?: EntityAvatarSize;
  ring?: boolean | 'hero';
  tint?: EntityAvatarTint;
  /** Lifecycle dot. Decorative: the row or header must also name the status. */
  status?: EntityAvatarStatus;
  /** Accessible name when the dot is the only place a status appears. */
  statusLabel?: string;
  className?: string;
}) {
  const avatar = (
    <Avatar
      className={cn(
        SIZE_CLASS[size],
        ring === 'hero' && 'm-1.5 ring-[6px] ring-card',
        ring === true && 'ring-2 ring-border ring-offset-2 ring-offset-background',
        className,
      )}
    >
      {avatarKey ? <AvatarImage src={avatarSrc(avatarKey as AvatarKeyDto)} alt="" /> : null}
      <AvatarFallback className={cn('font-medium', TINT_CLASS[tint], INITIALS_CLASS[size])}>
        {nameInitials(fullName)}
      </AvatarFallback>
    </Avatar>
  );

  if (!status) {
    return avatar;
  }

  return (
    <span className="relative inline-flex shrink-0">
      {avatar}
      <span
        role={statusLabel ? 'img' : undefined}
        aria-label={statusLabel}
        aria-hidden={statusLabel ? undefined : true}
        data-slot="entity-avatar-status"
        className={cn(
          'absolute -right-px -bottom-px size-[13px] rounded-pill border-[3px] border-card',
          STATUS_CLASS[status],
        )}
      />
    </span>
  );
}
