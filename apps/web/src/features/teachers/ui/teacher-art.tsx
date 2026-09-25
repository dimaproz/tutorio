import type { CSSProperties } from 'react';
import type { AvatarKeyDto } from '@tutorio/validation';
import { EntityAvatar, type EntityAvatarSize } from '@/components/shared/entity-avatar';
import { cn } from '@/lib/utils';

/**
 * A teacher's calendar colour as the `--teacher` custom property: the tint,
 * ring and week utilities of the teacher pages mix it with the theme's
 * surfaces. Teacher colours are user data (design-system.md), never tokens.
 */
export function teacherStyle(color: string): CSSProperties {
  return { '--teacher': color } as CSSProperties;
}

/** The surfaces the teacher's colour tints (S09 decision 2). */
export const TEACHER_TINT = {
  /** The card band and the profile header: 16% of the colour on the card. */
  band: 'bg-[color-mix(in_oklab,var(--teacher)_16%,var(--card))]',
  /** A chip's icon tile. */
  tile: 'bg-[color-mix(in_oklab,var(--teacher)_14%,var(--card))] text-(--teacher)',
} as const;

const CIRCLES = {
  band: { width: 176, height: 72, ring: [120, 10, 46, 10], dot: [40, 70, 18] },
  hero: { width: 520, height: 200, ring: [380, 30, 110, 22], dot: [120, 190, 44] },
  heroTablet: { width: 360, height: 170, ring: [270, 20, 84, 18], dot: [70, 170, 34] },
  heroPhone: { width: 240, height: 150, ring: [190, 16, 64, 14], dot: [40, 146, 26] },
} as const;

/**
 * The teacher pages' motif: a ring and a dot in the teacher's colour behind
 * the card band or the profile header. Decorative and absolutely placed by
 * the caller; only the block's own edge clips it.
 */
export function TeacherCircles({
  variant,
  className,
}: {
  variant: keyof typeof CIRCLES;
  className?: string;
}) {
  const shape = CIRCLES[variant];
  const [cx, cy, r, width] = shape.ring;
  const [dx, dy, dr] = shape.dot;
  return (
    <svg
      aria-hidden="true"
      width={shape.width}
      height={shape.height}
      viewBox={`0 0 ${shape.width} ${shape.height}`}
      overflow="visible"
      className={cn('pointer-events-none absolute top-0', className)}
    >
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="var(--teacher)"
        strokeOpacity={0.35}
        strokeWidth={width}
      />
      <circle cx={dx} cy={dy} r={dr} fill="var(--teacher)" fillOpacity={0.18} />
    </svg>
  );
}

/** The gold crown over the owner's avatar; the caller names it. */
export function OwnerCrown({ label, className }: { label: string; className?: string }) {
  return (
    <svg
      role="img"
      aria-label={label}
      viewBox="-1.5 -1.5 27 22"
      overflow="visible"
      className={cn('-rotate-8 drop-shadow-sm', className)}
    >
      <path
        d="M2 5.5l5 4.5 5-8 5 8 5-4.5-2 11.5H4z"
        className="fill-crown stroke-crown-line"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <circle cx="2" cy="5" r="1.8" className="fill-crown stroke-crown-line" strokeWidth="1" />
      <circle cx="12" cy="1.9" r="1.8" className="fill-crown stroke-crown-line" strokeWidth="1" />
      <circle cx="22" cy="5" r="1.8" className="fill-crown stroke-crown-line" strokeWidth="1" />
      <rect x="4" y="15.5" width="16" height="2.4" rx="1" className="fill-crown-base" />
    </svg>
  );
}

const RING = {
  thin: 'ring-[3px]',
  thick: 'ring-4',
} as const;

const CROWN = {
  xs: 'top-[-9px] w-4',
  sm: 'top-[-10px] w-[18px]',
  md: 'top-[-12px] w-5',
  lg: 'top-[-15px] w-6',
  xl: 'top-[-18px] w-7',
  '2xl': 'top-[-18px] w-7',
} as const satisfies Record<EntityAvatarSize, string>;

/**
 * A teacher's avatar ringed in their colour (3px on lists and cards, 4px on
 * the profile), the owner's with the crown above. `framed` puts a card-colour
 * gap around the ring, for an avatar that overlaps a tinted band.
 */
export function TeacherAvatar({
  avatarKey,
  fullName,
  color,
  size = 'md',
  ring = 'thin',
  owner = false,
  crownLabel,
  framed = false,
  muted = false,
  avatarClassName,
  className,
}: {
  avatarKey: AvatarKeyDto | string | null;
  fullName: string;
  color: string;
  size?: EntityAvatarSize;
  ring?: keyof typeof RING;
  owner?: boolean;
  /** The crown's accessible name; required with `owner`. */
  crownLabel?: string;
  framed?: boolean;
  /** Archived: the ring and the initials go grey. */
  muted?: boolean;
  /** Responsive sizes on the avatar itself, e.g. the profile header's. */
  avatarClassName?: string;
  className?: string;
}) {
  return (
    <span
      style={teacherStyle(color)}
      className={cn(
        'relative inline-flex shrink-0 rounded-pill',
        framed && 'bg-card p-1',
        className,
      )}
    >
      <EntityAvatar
        avatarKey={avatarKey}
        fullName={fullName}
        size={size}
        tint="indigo"
        className={cn(
          RING[ring],
          muted ? 'ring-muted-foreground/50' : 'ring-(--teacher)',
          avatarClassName,
        )}
      />
      {owner ? (
        <OwnerCrown
          label={crownLabel ?? ''}
          className={cn('absolute left-1/2 -translate-x-1/2', CROWN[size])}
        />
      ) : null}
    </span>
  );
}
