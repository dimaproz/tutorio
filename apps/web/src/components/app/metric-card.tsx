import { type LucideIcon } from 'lucide-react';
import { sectionToneClass, type SectionTone } from '@/components/app/section-tone';
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { cn } from '@/lib/utils';

/** A compact KPI card shared by entity detail pages and dashboard sections. */
export function MetricCard({
  icon: Icon,
  tone = 'primary',
  label,
  value,
  description,
  className,
}: {
  icon: LucideIcon;
  tone?: SectionTone;
  label: string;
  value: React.ReactNode;
  description?: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={cn('min-w-0', className)}>
      <CardHeader>
        <CardTitle className="text-sm font-normal text-muted-foreground">{label}</CardTitle>
        <CardAction>
          <span className={cn('grid size-9 place-items-center rounded-xl', sectionToneClass[tone])}>
            <Icon aria-hidden="true" className="size-4" />
          </span>
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
