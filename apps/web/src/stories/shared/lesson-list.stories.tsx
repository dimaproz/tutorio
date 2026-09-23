import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { CalendarIcon, MoreHorizontalIcon } from 'lucide-react';
import { expect, fn, userEvent, within } from 'storybook/test';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/empty-state';
import { IconButton } from '@/components/shared/icon-button';
import {
  LessonList,
  type LessonListGroup,
  type LessonListItem,
} from '@/components/shared/lesson-list';

const TOPICS = [
  'Speaking practice',
  'Grammar: past perfect',
  'Speaking: debates',
  'Listening lab',
  'Vocabulary: travel',
  'Reading club',
  'Writing workshop',
];

function lesson(index: number, past: boolean): LessonListItem {
  const day = past ? 9 - index : 11 + index * 2;
  return {
    id: `${past ? 'p' : 'u'}${index}`,
    weekday: ['Tue', 'Thu'][index % 2]!,
    day: String(Math.max(1, day)).padStart(2, '0'),
    title: TOPICS[index % TOPICS.length],
    meta: past
      ? 'Sep · 17:00 · came 5 of 6'
      : 'Sep · 17:00 – 18:00 · Dmytro Tutor',
    metaShort: past ? '17:00 · came 5 of 6' : '17:00 – 18:00 · Dmytro',
    status: past ? (
      <Badge variant="success">Taught</Badge>
    ) : index === 0 ? (
      <Badge variant="brand">Next</Badge>
    ) : (
      <Badge variant="info">Scheduled</Badge>
    ),
    state: past ? 'past' : index === 0 ? 'next' : 'default',
    menu: (
      <IconButton tone="ghost" size={36} icon={<MoreHorizontalIcon />} label="Lesson actions" />
    ),
  };
}

type Content = 'both' | 'upcoming' | 'past' | 'empty' | 'long';

type Args = {
  content: Content;
  header: 'title' | 'tabs' | 'none';
  compact: boolean;
  loading: boolean;
  loadingMore: boolean;
  maxHeight: number;
  onAction: () => void;
};

const COUNTS: Record<Content, { upcoming: number; past: number }> = {
  both: { upcoming: 3, past: 4 },
  upcoming: { upcoming: 3, past: 0 },
  past: { upcoming: 0, past: 4 },
  empty: { upcoming: 0, past: 0 },
  long: { upcoming: 12, past: 24 },
};

/**
 * The lesson list with its fixed height. `content` switches the design's
 * cases (upcoming and past, only one of them, empty, a long list that
 * scrolls), `header` the group (title) and student (tabs) flavours, and
 * `compact` the phone density. "Show more" reveals rows in the same box.
 */
function LessonListStory({
  content,
  header,
  compact,
  loading,
  loadingMore,
  maxHeight,
  onAction,
}: Args) {
  const counts = COUNTS[content];
  const all = [
    ...Array.from({ length: counts.upcoming }, (_, index) => lesson(index, false)),
    ...Array.from({ length: counts.past }, (_, index) => lesson(index, true)),
  ];
  const [shown, setShown] = useState(7);
  const [tab, setTab] = useState('lessons');
  const visible = all.slice(0, shown);
  const groups: LessonListGroup[] = [
    {
      label: 'Coming up · Tue and Thu at 17:00',
      items: visible.filter((item) => item.state !== 'past'),
    },
    { label: 'Earlier', items: visible.filter((item) => item.state === 'past') },
  ];
  const more = Math.min(12, all.length - shown);

  return (
    <div className="w-170 max-w-full">
      <LessonList
        header={
          header === 'title'
            ? { kind: 'title', title: 'Group lessons', meta: `${all.length} in total · ${counts.upcoming} ahead` }
            : header === 'tabs'
              ? {
                  kind: 'tabs',
                  label: 'Profile sections',
                  value: tab,
                  onChange: setTab,
                  items: [
                    { value: 'lessons', label: 'Lessons' },
                    { value: 'packages', label: 'Packages' },
                  ],
                }
              : undefined
        }
        action={{ label: 'Schedule lesson', onClick: onAction }}
        groups={groups}
        maxHeight={maxHeight}
        shown={visible.length}
        total={all.length}
        countLabel={`Showing ${visible.length} of ${all.length}`}
        onLoadMore={() => setShown((current) => current + 12)}
        loadMoreLabel={`Show ${more} more`}
        loadingMore={loadingMore}
        loading={loading}
        loadingLabel="Loading lessons"
        regionLabel="Group lessons"
        compact={compact}
        empty={
          <EmptyState
            icon={<CalendarIcon />}
            title="No lessons yet"
            text="Set up the schedule and the lessons appear here on their own."
          />
        }
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Lists/LessonList',
  component: LessonListStory,
  args: {
    content: 'both',
    header: 'title',
    compact: false,
    loading: false,
    loadingMore: false,
    maxHeight: 360,
    onAction: fn(),
  },
  argTypes: {
    content: { control: 'inline-radio', options: ['both', 'upcoming', 'past', 'empty', 'long'] },
    header: { control: 'inline-radio', options: ['title', 'tabs', 'none'] },
    maxHeight: { control: { type: 'range', min: 200, max: 600, step: 20 } },
  },
} satisfies Meta<typeof LessonListStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** "Show more" fills the same scrolling box and the counter follows. */
export const LoadsMoreInPlace: Story = {
  args: { content: 'long' },
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    const region = canvas.getByRole('region', { name: 'Group lessons' });
    await expect(within(region).getAllByRole('listitem')).toHaveLength(8);
    await expect(canvas.getByText('Showing 7 of 36')).toBeVisible();

    await userEvent.click(canvas.getByRole('button', { name: 'Show 12 more' }));

    await expect(canvas.getByText('Showing 19 of 36')).toBeVisible();
    // Still one scrolling region: the page did not grow a second list.
    await expect(canvas.getAllByRole('region')).toHaveLength(1);
    await expect(region.scrollHeight).toBeGreaterThan(region.clientHeight);
  },
};
