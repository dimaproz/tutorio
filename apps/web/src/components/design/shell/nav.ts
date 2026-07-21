import { LayoutGridIcon, LayoutTemplateIcon, SwatchBookIcon, ComponentIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Single source of truth for the lab's sections. The sidebar renders these as
// nav items; page.tsx maps the same keys to the section components. Keys must
// stay in sync between the two.
export const NAV_ITEMS: { key: string; label: string; icon: LucideIcon }[] = [
  { key: 'overview', label: 'Огляд', icon: LayoutGridIcon },
  { key: 'foundations', label: 'Основа', icon: SwatchBookIcon },
  { key: 'components', label: 'Компоненти', icon: ComponentIcon },
  { key: 'patterns', label: 'Патерни', icon: LayoutTemplateIcon },
];
