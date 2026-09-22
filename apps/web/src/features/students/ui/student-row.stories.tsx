import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ColumnDef } from '@tanstack/react-table';
import type { StudentListItem } from '@tutorio/validation';
import { DataTable } from '@/components/shared/data-table';
import type { StudentRollup } from '@/features/students/model/rollups';
import { SAMPLE_STUDENTS, STORY_CLOCK, StoryBackend } from '@/stories/story-backend';
import { StudentCard } from './student-card';
import {
  StudentBalanceCell,
  StudentCreditsCell,
  StudentIdentityCell,
  StudentLearningCell,
  StudentNextLessonCell,
} from './student-row-cells';

type Args = {
  presentation: 'row' | 'card';
  status: 'ACTIVE' | 'ON_HOLD' | 'ARCHIVED';
  left: number;
  total: number;
  today: boolean;
  balance: 'paid' | 'partial' | 'due' | 'none';
  teacher: string;
  highlighted: boolean;
};

function rollupFrom(args: Args): StudentRollup {
  const start = args.today
    ? STORY_CLOCK + 3 * 60 * 60 * 1000
    : STORY_CLOCK + 2 * 24 * 60 * 60 * 1000;
  return {
    credits: args.total > 0 ? { left: args.left, total: args.total } : undefined,
    balance:
      args.balance === 'none'
        ? undefined
        : args.balance === 'paid'
          ? { kind: 'paid' }
          : { kind: args.balance, owedMinor: 240000, currency: 'UAH' },
    next: {
      startsAtUtc: new Date(start).toISOString(),
      durationMin: 60,
      teacherName: args.teacher,
    },
    teacherName: args.teacher,
  };
}

/**
 * One student in the collection: `row` is the desktop StudentRow in its
 * table, `card` the phone StudentCardMobile. Credits at two or fewer turn the
 * meter coral; an archived student is dimmed.
 */
function StudentRowStory(args: Args) {
  const base = SAMPLE_STUDENTS[args.status === 'ARCHIVED' ? 7 : args.status === 'ON_HOLD' ? 6 : 0];
  const student: StudentListItem = {
    id: base.id,
    fullName: base.fullName,
    email: base.email,
    phone: base.phone,
    telegramUsername: base.telegramUsername,
    timezone: base.timezone,
    status: args.status,
    hourlyRateMinor: base.hourlyRateMinor,
    currency: base.currency,
    avatarKey: base.avatarKey,
    createdAt: base.createdAt,
    deletedAt: args.status === 'ARCHIVED' ? '2026-09-01T10:00:00.000Z' : null,
    activeEnrollmentCount: 1,
    groupNames: base.groupNames,
  };
  const rollup = rollupFrom(args);

  if (args.presentation === 'card') {
    return (
      <StoryBackend>
        <div className="w-89.5 bg-background p-4">
          <StudentCard student={student} rollup={rollup} now={STORY_CLOCK} />
        </div>
      </StoryBackend>
    );
  }

  const columns: ColumnDef<StudentListItem, unknown>[] = [
    {
      id: 'student',
      header: () => 'Student',
      cell: ({ row }) => <StudentIdentityCell student={row.original} />,
    },
    {
      id: 'learning',
      header: () => 'Learning',
      cell: ({ row }) => (
        <StudentLearningCell student={row.original} teacher={rollup.teacherName} />
      ),
    },
    {
      id: 'credits',
      header: () => 'Credits',
      cell: () => <StudentCreditsCell credits={rollup.credits} />,
    },
    {
      id: 'next',
      header: () => 'Next lesson',
      cell: ({ row }) => (
        <StudentNextLessonCell status={row.original.status} next={rollup.next} now={STORY_CLOCK} />
      ),
    },
    {
      id: 'balance',
      header: () => 'Balance',
      cell: ({ row }) => (
        <StudentBalanceCell balance={rollup.balance} status={row.original.status} />
      ),
    },
  ];

  return (
    <StoryBackend>
      <div className="w-270 rounded-card bg-card p-2">
        <DataTable
          variant="rows"
          layout="minmax(0,2.3fr) minmax(0,1.5fr) minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,1fr)"
          columns={columns}
          data={[student]}
          caption="Students"
          isRowHighlighted={() => args.highlighted}
          isRowDimmed={(row) => row.status === 'ARCHIVED'}
        />
      </div>
    </StoryBackend>
  );
}

const meta = {
  title: 'Students/Components/StudentRow',
  component: StudentRowStory,
  args: {
    presentation: 'row',
    status: 'ACTIVE',
    left: 6,
    total: 8,
    today: false,
    balance: 'paid',
    teacher: 'Dmytro Tutor',
    highlighted: false,
  },
  argTypes: {
    presentation: {
      control: 'inline-radio',
      options: ['row', 'card'],
      description: '`card` is StudentCardMobile.',
    },
    status: { control: 'inline-radio', options: ['ACTIVE', 'ON_HOLD', 'ARCHIVED'] },
    left: { control: { type: 'range', min: 0, max: 12 } },
    total: { control: { type: 'range', min: 0, max: 12 } },
    balance: { control: 'inline-radio', options: ['paid', 'partial', 'due', 'none'] },
  },
} satisfies Meta<typeof StudentRowStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const LowCreditsToday: Story = {
  args: { left: 1, today: true, balance: 'due', highlighted: true },
};

export const MobileCard: Story = { args: { presentation: 'card' } };
