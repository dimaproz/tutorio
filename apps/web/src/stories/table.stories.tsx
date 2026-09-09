import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import ukMessages from '../../messages/uk.json';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { NarrowStoryContainer } from './story-helpers';

function TableContract({ longCopy = false }: { longCopy?: boolean }) {
  return (
    <Table>
      <TableCaption>{longCopy ? ukMessages.students.tableCaption : 'Students in the workspace'}</TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Student</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Rate</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow>
          <TableCell className="font-medium">Anna Shevchenko</TableCell>
          <TableCell><Badge variant="primary">Active</Badge></TableCell>
          <TableCell className="text-right">500 UAH</TableCell>
        </TableRow>
      </TableBody>
    </Table>
  );
}

const meta = {
  title: 'Foundation/Table',
  component: TableContract,
} satisfies Meta<typeof TableContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const LongUkrainianCopy: Story = {
  args: { longCopy: true },
  globals: { locale: 'uk' },
};

export const NarrowMobile: Story = {
  render: () => <NarrowStoryContainer><TableContract /></NarrowStoryContainer>,
};
