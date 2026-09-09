'use client';

import { useTranslations } from 'next-intl';
import { AuditLogTable } from './audit-log-table';
import { WorkspaceSettingsForm } from './workspace-settings-form';
import { PageHeader } from '@/components/app/page-shell';
import { useSession } from '@/components/app/session-provider';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export function SettingsView() {
  const t = useTranslations('settings');
  const session = useSession();

  // Hiding the screen is a courtesy, not the security boundary — the API
  // rejects both endpoints for a teacher regardless of what the UI shows.
  if (session.role !== 'OWNER') {
    return (
      <Alert>
        <AlertTitle>{t('ownerOnly.title')}</AlertTitle>
        <AlertDescription>{t('ownerOnly.description')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={t('title')} description={t('subtitle')} />

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">{t('tabs.general')}</TabsTrigger>
          <TabsTrigger value="audit">{t('tabs.audit')}</TabsTrigger>
        </TabsList>
        <TabsContent value="general" className="pt-4">
          <WorkspaceSettingsForm />
        </TabsContent>
        <TabsContent value="audit" className="pt-4">
          <AuditLogTable />
        </TabsContent>
      </Tabs>
    </div>
  );
}
