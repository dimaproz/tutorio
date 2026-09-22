import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useState } from 'react';
import { expect, userEvent } from 'storybook/test';
import { ListPagination } from '@/components/shared/list-controls';

type Args = { total: number; current: number };

/** Round page numbers; the current one is ink and carries `aria-current`. */
function PaginationStory({ total, current }: Args) {
  const [page, setPage] = useState(current);
  return <ListPagination page={Math.min(page, total)} totalPages={total} onPageChange={setPage} />;
}

const meta = {
  title: 'Shared/Collection/Pagination',
  component: PaginationStory,
  args: { total: 6, current: 1 },
  argTypes: {
    total: { control: { type: 'range', min: 2, max: 20 } },
    current: { control: { type: 'range', min: 1, max: 20 } },
  },
} satisfies Meta<typeof PaginationStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas }) => {
    const second = canvas.getByRole('link', { name: /2$/ });
    await userEvent.click(second);
    await expect(second).toHaveAttribute('aria-current', 'page');
  },
};
