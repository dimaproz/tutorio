import type { AvatarKeyDto } from '@tutorio/validation';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn, nameInitials } from '@/lib/utils';

// The single avatar used for every person in the product (students, parents,
// teachers). A picked illustration renders as an image; otherwise it falls back
// to initials. `ring` adds the TailAdmin-style halo (a gap + soft outline) used
// on profile headers.
const SIZE_CLASS = {
  xs: 'size-7 text-xs',
  sm: 'size-9 text-xs',
  md: 'size-11 text-sm',
  lg: 'size-14 text-base',
  xl: 'size-20 text-xl',
} as const;

export type EntityAvatarSize = keyof typeof SIZE_CLASS;

export function avatarSrc(avatarKey: AvatarKeyDto): string {
  return `/images/tailadmin/avatars/${avatarKey}.jpg`;
}

export function EntityAvatar({
  avatarKey,
  fullName,
  size = 'md',
  ring = false,
  className,
}: {
  avatarKey?: AvatarKeyDto | string | null;
  fullName: string;
  size?: EntityAvatarSize;
  ring?: boolean;
  className?: string;
}) {
  return (
    <Avatar
      className={cn(
        SIZE_CLASS[size],
        ring && 'ring-2 ring-border ring-offset-2 ring-offset-background',
        className,
      )}
    >
      {avatarKey ? <AvatarImage src={avatarSrc(avatarKey as AvatarKeyDto)} alt="" /> : null}
      <AvatarFallback className="font-medium">{nameInitials(fullName)}</AvatarFallback>
    </Avatar>
  );
}
