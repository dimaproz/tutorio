import { Clock3Icon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

/** One weekly meeting slot, reusable anywhere recurring schedules are shown. */
export function ScheduleSlotCard({
  weekday,
  timeRange,
  duration,
  timezone,
}: {
  weekday: string;
  timeRange: string;
  duration: string;
  timezone: string;
}) {
  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Badge variant="primary">{weekday}</Badge>
          <span>{timeRange}</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock3Icon aria-hidden="true" className="size-3.5" />
        <span>{duration}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{timezone}</span>
      </CardContent>
    </Card>
  );
}
