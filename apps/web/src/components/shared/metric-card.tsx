import { type LucideIcon } from 'lucide-react';
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
  label,
  value,
  description,
  className,
}: {
  icon: LucideIcon;
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
          <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
        </CardAction>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="tabular text-2xl font-semibold tracking-tight">{value}</p>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardContent>
    </Card>
  );
}
