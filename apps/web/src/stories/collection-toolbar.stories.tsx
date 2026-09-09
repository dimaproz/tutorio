import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect } from 'storybook/test';
import { CollectionToolbar } from '@/components/shared/collection-toolbar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NarrowStoryContainer } from './story-helpers';

function CollectionToolbarContract() {
  const [query, setQuery] = useState('');

  return (
    <CollectionToolbar>
      <label className="sr-only" htmlFor="student-search">Search students</label>
      <Input
        id="student-search"
        className="sm:max-w-xs"
        placeholder="Name, email, or phone"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />
      <Select defaultValue="active">
        <SelectTrigger className="sm:w-44" aria-label="Student status">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="active">Active students</SelectItem>
          <SelectItem value="archived">Archived students</SelectItem>
        </SelectContent>
      </Select>
      <Button className="sm:ml-auto">Add student</Button>
    </CollectionToolbar>
  );
}

const meta = {
  title: 'Shared/CollectionToolbar',
  component: CollectionToolbarContract,
} satisfies Meta<typeof CollectionToolbarContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const NarrowMobile: Story = {
  render: () => <NarrowStoryContainer><CollectionToolbarContract /></NarrowStoryContainer>,
};

export const SearchChangesTheControlledValue: Story = {
  play: async ({ canvas, userEvent }) => {
    const input = canvas.getByRole('textbox', { name: 'Search students' });
    await userEvent.type(input, 'Anna');
    await expect(input).toHaveValue('Anna');
  },
};
