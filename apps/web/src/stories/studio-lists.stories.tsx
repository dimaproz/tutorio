import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { MoreHorizontalIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DateTile } from '@/components/shared/date-tile';
import { LessonItem } from '@/components/shared/lesson-item';
import { SectionDivider } from '@/components/shared/section-divider';

const meta = { title: 'Shared/Dates and lessons' } satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

function LessonActions({ label }: { label: string }) {
  return (
    <Button variant="ghost" size="icon-sm" aria-label={label}>
      <MoreHorizontalIcon />
    </Button>
  );
}

export const DateTiles: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3">
      <DateTile top="Thu" day="11" state="highlighted" />
      <DateTile top="Tue" day="16" />
      <DateTile top="Tue" day="09" state="past" />
      <DateTile top="Sep" day="04" size={52} />
    </div>
  ),
};

/** The same tiles on a white card, where the paper fill has to stay visible. */
export const DateTilesOnSurface: Story = {
  render: () => (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-card p-5">
      <DateTile top="Thu" day="11" state="highlighted" />
      <DateTile top="Tue" day="16" />
      <DateTile top="Tue" day="09" state="past" />
      <DateTile top="Sep" day="04" size={52} />
    </div>
  ),
};

export const Divider: Story = {
  render: () => (
    <div className="flex flex-col gap-4">
      <SectionDivider label="Coming up · Tue & Thu at 17:00" />
      <SectionDivider label="Earlier" />
      <SectionDivider label="Lessons rescheduled after the winter break and awaiting confirmation" />
    </div>
  ),
};

export const Lessons: Story = {
  render: () => (
    <div className="flex flex-col rounded-card bg-card p-5">
      <SectionDivider label="Coming up · Tue & Thu at 17:00" className="mb-2" />
      <LessonItem
        state="next"
        date={{ top: 'Thu', day: '11' }}
        title="Speaking practice"
        meta="Sep · 17:00 – 18:00 · Dmytro Tutor"
        status={<Badge variant="brand">Next</Badge>}
        actions={<LessonActions label="Speaking practice actions" />}
      />
      <LessonItem
        date={{ top: 'Tue', day: '16' }}
        title="Grammar: past perfect"
        meta="Sep · 17:00 – 18:00 · Dmytro Tutor"
        status={<Badge variant="info">Scheduled</Badge>}
        actions={<LessonActions label="Grammar actions" />}
      />
      <LessonItem
        date={{ top: 'Thu', day: '18' }}
        title="Mock exam · Reading & writing and a long topic that has to truncate"
        meta="Sep · 17:00 – 18:30 · Dmytro Tutor"
        status={<Badge variant="info">Scheduled</Badge>}
        actions={<LessonActions label="Mock exam actions" />}
      />
      <SectionDivider label="Earlier" className="my-2" />
      <LessonItem
        state="past"
        date={{ top: 'Tue', day: '09' }}
        title="Listening"
        meta="Sep · 17:00 – 18:00 · attended · 1 credit used"
        status={<Badge variant="success">Completed</Badge>}
        actions={<LessonActions label="Listening actions" />}
      />
      <LessonItem
        state="past"
        date={{ top: 'Thu', day: '04' }}
        title="Vocabulary"
        meta="Sep · Cancelled 3 h before start · charged"
        status={<Badge variant="danger">Late cancel</Badge>}
        actions={<LessonActions label="Vocabulary actions" />}
      />
    </div>
  ),
};

export const LessonsUkrainian: Story = {
  globals: { locale: 'uk' },
  render: () => (
    <div className="flex flex-col rounded-card bg-card p-5">
      <SectionDivider label="Найближчі · вівторок і четвер о 17:00" className="mb-2" />
      <LessonItem
        state="next"
        date={{ top: 'Чт', day: '11' }}
        title="Розмовна практика"
        meta="вер · 17:00 – 18:00 · Дмитро Репетитор"
        status={<Badge variant="brand">Наступний</Badge>}
        actions={<LessonActions label="Дії уроку" />}
      />
      <LessonItem
        date={{ top: 'Вт', day: '16' }}
        title="Граматика: past perfect"
        meta="вер · 17:00 – 18:00 · Дмитро Репетитор"
        status={<Badge variant="info">Заплановано</Badge>}
        actions={<LessonActions label="Дії уроку" />}
      />
    </div>
  ),
};
