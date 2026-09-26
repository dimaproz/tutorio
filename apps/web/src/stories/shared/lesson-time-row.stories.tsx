import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent } from 'storybook/test';
import { LayersIcon, MoreHorizontalIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { EntityAvatar } from '@/components/shared/entity-avatar';
import { IconButton } from '@/components/shared/icon-button';
import {
  CoinMark,
  LessonNowLine,
  LessonTimeRow,
  LessonTimeRowSkeleton,
  type LessonTimeRowState,
} from '@/components/shared/lesson-time-row';
import { TEACHER_COLORS } from '@/lib/theme/user-colors';

type Args = {
  state: LessonTimeRowState;
  dense: boolean;
  group: boolean;
  tint: 'none' | (typeof TEACHER_COLORS)[number];
  name: string;
  meta: string;
  badge: string;
  loading: boolean;
  onSelect: () => void;
};

/**
 * `LessonTimeRow` (S11 section 3): one lesson of a day by its time. The time
 * column by state — ahead, now, past, cancelled —, a teacher's colour over it
 * where several teachers are shown, the body with media, name and meta, and
 * the right side: a badge and the `⋯` on desktop, a mark on a `dense` row.
 * The domain mapping is `TimedLessonRow` (`Lessons/Patterns/TimedLessonRow`).
 */
function LessonTimeRowStory({
  state,
  dense,
  group,
  tint,
  name,
  meta,
  badge,
  loading,
  onSelect,
}: Args) {
  return (
    <div className="flex w-160 max-w-full flex-col gap-2 rounded-card bg-card p-4">
      {loading ? (
        <LessonTimeRowSkeleton dense={dense} />
      ) : (
        <LessonTimeRow
          start="12:30"
          end="13:30"
          state={state}
          dense={dense}
          tint={tint === 'none' ? null : tint}
          media={
            group ? (
              <span className="flex size-9 items-center justify-center rounded-control bg-tile-indigo text-tile-indigo-foreground [&_svg]:size-4.5">
                <LayersIcon />
              </span>
            ) : (
              <EntityAvatar avatarKey="user-8" fullName={name} size="sm" tint="indigo" />
            )
          }
          name={name}
          meta={meta}
          trailing={
            dense ? (
              <CoinMark className="size-5 text-[11px]" />
            ) : (
              <>
                <Badge variant="brand">{badge}</Badge>
                <IconButton
                  tone="ghost"
                  size={32}
                  icon={<MoreHorizontalIcon />}
                  label="Lesson actions"
                />
              </>
            )
          }
          onSelect={onSelect}
          selectLabel={`Open the lesson: ${name}`}
        />
      )}
      <LessonNowLine label="13:05" />
    </div>
  );
}

const meta = {
  title: 'Shared/Lists/LessonTimeRow',
  component: LessonTimeRowStory,
  args: {
    state: 'now',
    dense: false,
    group: false,
    tint: 'none',
    name: 'Roman Kyrylenko',
    meta: 'individual · Speaking: travel',
    badge: 'Now · 25 min left',
    loading: false,
    onSelect: fn(),
  },
  argTypes: {
    state: { control: 'inline-radio', options: ['ahead', 'now', 'past', 'cancelled'] },
    tint: { control: 'select', options: ['none', ...TEACHER_COLORS] },
  },
} satisfies Meta<typeof LessonTimeRowStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Open the lesson: Roman Kyrylenko' }));
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
    // The menu sits above the row button and keeps its own click.
    await userEvent.click(canvas.getByRole('button', { name: 'Lesson actions' }));
    await expect(args.onSelect).toHaveBeenCalledTimes(1);
  },
};
