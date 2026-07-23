// Shared palette for the tinted icon squares on section headers — used by the
// form sections (FormSection) and the detail-view section titles (SectionTitle)
// so the same concept wears the same colour in create/edit and read views.
// Each tone is a soft wash + saturated icon colour, tuned for light and dark.
// Class strings are written out in full so Tailwind's scanner emits them.
export type SectionTone =
  | 'neutral'
  | 'indigo'
  | 'sky'
  | 'cyan'
  | 'violet'
  | 'fuchsia'
  | 'emerald'
  | 'amber'
  | 'rose';

export const sectionToneClass: Record<SectionTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  indigo: 'bg-indigo-50 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-400',
  sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/15 dark:text-sky-400',
  cyan: 'bg-cyan-50 text-cyan-600 dark:bg-cyan-500/15 dark:text-cyan-400',
  violet: 'bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400',
  fuchsia: 'bg-fuchsia-50 text-fuchsia-600 dark:bg-fuchsia-500/15 dark:text-fuchsia-400',
  emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-400',
  amber: 'bg-amber-50 text-amber-600 dark:bg-amber-500/15 dark:text-amber-400',
  rose: 'bg-rose-50 text-rose-600 dark:bg-rose-500/15 dark:text-rose-400',
};
