import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const SKELETON_ROWS = Array.from({ length: 8 });

/**
 * First-load placeholder for the students collection. It deliberately mirrors
 * the final desktop columns and mobile cards, so the page keeps its shape
 * while the first response arrives.
 */
export function StudentsListSkeleton({
  caption,
  loadingLabel,
}: {
  caption: string;
  loadingLabel: string;
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">{loadingLabel}</span>

      <div className="flex flex-col gap-3 md:hidden" aria-hidden="true">
        {SKELETON_ROWS.slice(0, 3).map((_, index) => (
          <Card key={index}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />
                <div className="flex flex-1 flex-col gap-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-44" />
                </div>
              </div>
              <Skeleton className="size-8" />
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-4 w-28" />
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="hidden md:block" aria-hidden="true">
        <Table>
          <TableCaption className="sr-only">{caption}</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[16%]">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-[11%]">
                <Skeleton className="h-4 w-14" />
              </TableHead>
              <TableHead className="w-[31%]">
                <Skeleton className="h-4 w-14" />
              </TableHead>
              <TableHead className="w-[12%]">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-[15%]">
                <Skeleton className="h-4 w-16" />
              </TableHead>
              <TableHead className="w-[12%]">
                <Skeleton className="h-4 w-20" />
              </TableHead>
              <TableHead className="w-12">
                <Skeleton className="ml-auto size-4" />
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {SKELETON_ROWS.map((_, index) => (
              <TableRow key={index}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Skeleton className="size-10 rounded-full" />
                    <Skeleton className="h-4 w-28" />
                  </div>
                </TableCell>
                <TableCell>
                  <Skeleton className="h-5 w-20 rounded-full" />
                </TableCell>
                <TableCell>
                  <Skeleton className={index % 2 ? 'h-4 w-40' : 'h-4 w-56'} />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-16" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-28" />
                </TableCell>
                <TableCell>
                  <Skeleton className="h-4 w-24" />
                </TableCell>
                <TableCell>
                  <Skeleton className="ml-auto size-5" />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
