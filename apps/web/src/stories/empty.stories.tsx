import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FolderSearchIcon } from 'lucide-react';
import ukMessages from '../../messages/uk.json';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

function EmptyContract({ longCopy = false }: { longCopy?: boolean }) {
  return (
    <Empty className="min-h-64">
      <EmptyHeader>
        <EmptyMedia variant="icon"><FolderSearchIcon /></EmptyMedia>
        <EmptyTitle>{longCopy ? ukMessages.students.empty.title : 'No students yet'}</EmptyTitle>
        <EmptyDescription>
          {longCopy ? ukMessages.students.empty.description : 'Add your first student to start building schedules and packages.'}
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <Button>Add student</Button>
      </EmptyContent>
    </Empty>
  );
}

const meta = {
  title: 'Foundation/Empty',
  component: EmptyContract,
} satisfies Meta<typeof EmptyContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongUkrainianCopy: Story = {
  args: { longCopy: true },
  globals: { locale: 'uk' },
};

export const Dark: Story = {
  globals: { theme: 'dark' },
};
