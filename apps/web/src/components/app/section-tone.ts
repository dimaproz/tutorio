// Shared palette for the tinted icon squares on section headers — used by the
// form sections (FormSection) and the detail-view section titles (SectionTitle)
// so the same concept wears the same colour in create/edit and read views.
// Each tone is a soft wash + saturated icon colour, tuned for light and dark.
// Class strings are written out in full so Tailwind's scanner emits them.
export type SectionTone = 'neutral' | 'primary' | 'success' | 'warning' | 'destructive';

export const sectionToneClass: Record<SectionTone, string> = {
  neutral: 'bg-muted text-muted-foreground',
  primary: 'bg-primary/10 text-primary',
  success: 'bg-success/10 text-success',
  warning: 'bg-warning/10 text-warning',
  destructive: 'bg-destructive/10 text-destructive',
};
