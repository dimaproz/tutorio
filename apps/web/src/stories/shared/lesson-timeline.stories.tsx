import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, within } from 'storybook/test';
import {
  BanknoteIcon,
  CalendarPlusIcon,
  CircleCheckIcon,
  CircleXIcon,
  PencilIcon,
  RepeatIcon,
  UserRoundIcon,
} from 'lucide-react';
import { LessonTimeline, type TimelineItem } from '@/components/shared/lesson-timeline';

const ITEMS: TimelineItem[] = [
  {
    id: 'cancel',
    icon: <CircleXIcon />,
    tone: 'danger',
    title: 'Скасовано учнем пізно',
    time: '11 вер · 14:05',
    meta: 'Olena Kovalenko · причина «Захворіла» · списано 1 заняття',
  },
  {
    id: 'held',
    icon: <CircleCheckIcon />,
    tone: 'success',
    title: 'Заняття відбулося',
    time: '4 вер · 18:00',
    meta: 'Автоматично після завершення · списано 1 заняття',
  },
  {
    id: 'topic',
    icon: <PencilIcon />,
    tone: 'plain',
    title: 'Змінено тему',
    time: '9 вер · 10:12',
    meta: '«Present Perfect» → «Past Perfect: розповідь про подорож»',
  },
  {
    id: 'teacher',
    icon: <UserRoundIcon />,
    tone: 'plain',
    title: 'Заміна викладача',
    time: '5 вер · 19:40',
    meta: 'Iryna Bondar → Dmytro Tutor · лише це заняття',
  },
  {
    id: 'price',
    icon: <BanknoteIcon />,
    tone: 'plain',
    title: 'Змінено ціну',
    time: '3 вер · 12:00',
    meta: '450 ₴ → 500 ₴',
  },
  {
    id: 'rebuilt',
    icon: <RepeatIcon />,
    tone: 'system',
    title: 'Перебудовано з розкладу',
    time: '1 вер · 09:00',
    meta: 'Час 16:00 → 17:00',
  },
  {
    id: 'created',
    icon: <CalendarPlusIcon />,
    tone: 'indigo',
    title: 'Створено з розкладу',
    time: '25 сер · 11:03',
  },
];

type Args = { count: number; visible: number; defaultExpanded: boolean; width: number };

/**
 * The lesson history: tone per event, three entries and "show all · N more"
 * that expands in place. Set `count` to shorten the history and `width` to see
 * the time wrap under the title.
 */
function LessonTimelineStory({ count, visible, defaultExpanded, width }: Args) {
  return (
    <div style={{ width }} className="max-w-full">
      <LessonTimeline
        key={`${defaultExpanded}`}
        items={ITEMS.slice(0, count)}
        visible={visible}
        defaultExpanded={defaultExpanded}
        showAllLabel={(hidden) => `Показати всю історію · ще ${hidden}`}
        collapseLabel="Згорнути історію"
        label="Історія"
      />
    </div>
  );
}

const meta = {
  title: 'Shared/Lists/LessonTimeline',
  component: LessonTimelineStory,
  args: { count: 7, visible: 3, defaultExpanded: false, width: 420 },
  argTypes: {
    count: { control: { type: 'range', min: 1, max: ITEMS.length } },
    visible: { control: { type: 'range', min: 1, max: ITEMS.length } },
    width: { control: { type: 'range', min: 260, max: 560, step: 10 } },
  },
} satisfies Meta<typeof LessonTimelineStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

/** "Show all" reveals the rest in place and turns into "collapse". */
export const ExpandsInPlace: Story = {
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
    await userEvent.click(canvas.getByRole('button', { name: /ще 4/ }));
    await expect(canvas.getAllByRole('listitem')).toHaveLength(7);
    await userEvent.click(canvas.getByRole('button', { name: 'Згорнути історію' }));
    await expect(canvas.getAllByRole('listitem')).toHaveLength(3);
  },
};
