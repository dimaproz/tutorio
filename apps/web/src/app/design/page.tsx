import { ComponentsSection } from '@/components/design/sections/components-section';
import { FoundationsSection } from '@/components/design/sections/foundations-section';
import { OverviewSection } from '@/components/design/sections/overview-section';
import { PatternsSection } from '@/components/design/sections/patterns-section';

// Sections live in the URL rather than in component state: a design review
// happens by sending someone a link to the exact section under discussion.
// The sidebar (see design-shell) drives navigation between them.
const SECTIONS = {
  overview: { label: 'Огляд', Component: OverviewSection },
  foundations: { label: 'Основа', Component: FoundationsSection },
  components: { label: 'Компоненти', Component: ComponentsSection },
  patterns: { label: 'Патерни', Component: PatternsSection },
} as const;

type SectionKey = keyof typeof SECTIONS;

function isSectionKey(value: string | undefined): value is SectionKey {
  return value !== undefined && value in SECTIONS;
}

export default async function DesignLabPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const { section } = await searchParams;
  const active: SectionKey = isSectionKey(section) ? section : 'overview';
  const { label, Component } = SECTIONS[active];

  return (
    <div className="mx-auto flex w-full max-w-[1440px] flex-col gap-6 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold md:text-2xl">{label}</h1>
        <nav aria-label="Хлібні крихти" className="text-muted-foreground flex items-center gap-1.5 text-sm">
          <span>Лабораторія</span>
          <span aria-hidden="true">/</span>
          <span className="text-foreground">{label}</span>
        </nav>
      </div>

      <Component />
    </div>
  );
}
