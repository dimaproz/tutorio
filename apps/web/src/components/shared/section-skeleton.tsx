import { Skeleton } from '@/components/ui/skeleton';

/** Loading placeholder shaped like one form section with `fields` inputs. */
export function SectionSkeleton({ fields = 2 }: { fields?: number }) {
  return (
    <section
      aria-hidden="true"
      data-slot="section-skeleton"
      className="flex flex-col gap-5 rounded-card bg-card px-7 py-6.5"
    >
      <div className="flex items-center gap-3.5">
        <Skeleton className="size-10 rounded-control bg-secondary" />
        <div className="flex grow flex-col gap-2">
          <Skeleton className="h-4 w-45 rounded-lg bg-secondary" />
          <Skeleton className="h-3 w-30 rounded-md bg-secondary" />
        </div>
      </div>
      {Array.from({ length: fields }, (_, index) => (
        <div key={index} className="flex flex-col gap-2">
          <Skeleton className="h-3.5 w-[30%] rounded-[7px] bg-secondary" />
          <Skeleton className="h-13 w-full rounded-field bg-secondary" />
        </div>
      ))}
    </section>
  );
}
