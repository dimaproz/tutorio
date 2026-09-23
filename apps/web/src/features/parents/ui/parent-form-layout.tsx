'use client';

import type { ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { FormPageLayout } from '@/components/shared/form-page-layout';
import { ProgressMeter } from '@/components/shared/progress-meter';
import type { SectionNavItem } from '@/components/shared/section-nav';

/**
 * The parent form's frame: the shared `FormPageLayout` with the parent labels
 * and the progress meter under the navigation.
 */
export function ParentFormLayout({
  title,
  subtitle,
  navItems,
  activeSection,
  onSelectSection,
  progressCaption,
  navNote,
  navLoading = false,
  notice,
  children,
  bar,
}: {
  title: ReactNode;
  subtitle: ReactNode;
  navItems: SectionNavItem[];
  activeSection?: string;
  onSelectSection?: (id: string) => void;
  /** Shows how much is filled in under the navigation. */
  progressCaption?: ReactNode;
  navNote?: ReactNode;
  /** Replaces the navigation with its skeleton while the record loads. */
  navLoading?: boolean;
  /** Banner above the sections, e.g. a request error. */
  notice?: ReactNode;
  children: ReactNode;
  bar?: ReactNode;
}) {
  const t = useTranslations('parents.form');
  const done = navItems.filter((item) => item.status === 'done').length;

  return (
    <FormPageLayout
      title={title}
      subtitle={subtitle}
      navItems={navItems}
      activeSection={activeSection}
      onSelectSection={onSelectSection}
      labels={{
        sections: t('sectionsLabel'),
        error: t('sectionHasError'),
        done: t('sectionDone'),
      }}
      navNote={navNote}
      navAside={
        progressCaption ? (
          <ProgressMeter
            value={done}
            total={navItems.length}
            label={t('progress', { done, total: navItems.length })}
            caption={progressCaption}
          />
        ) : undefined
      }
      navLoading={navLoading}
      notice={notice}
      bar={bar}
    >
      {children}
    </FormPageLayout>
  );
}
