import { CardTitle } from '@/components/ui/card';

type IconType = React.ComponentType<{ className?: string }>;

/** A card title with a leading muted icon. */
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
