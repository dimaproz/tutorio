import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GroupForm } from '@/components/groups/group-form';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('groups.form');
  return { title: t('createTitle') };
}

export default function NewGroupPage() {
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <GroupForm />
      </div>
    </main>
  );
}
