import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { GroupEditView } from '@/components/groups/group-edit';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('groups.form');
  return { title: t('editTitle') };
}

export default async function EditGroupPage({
  params,
}: {
  params: Promise<{ groupId: string }>;
}) {
  const { groupId } = await params;
  return (
    <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div className="w-full max-w-2xl">
        <GroupEditView groupId={groupId} />
      </div>
    </main>
  );
}
