import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  CircleCheckIcon,
  HistoryIcon,
  NotebookPenIcon,
  PackageIcon,
  RepeatIcon,
  TriangleAlertIcon,
  UserXIcon,
} from 'lucide-react';
import { ImpactList, type ImpactItem } from '@/components/shared/impact-list';

const SETS: Record<'move' | 'statusFix' | 'conflicts', ImpactItem[]> = {
  move: [
    {
      id: 'rebuilt',
      icon: <RepeatIcon />,
      tone: 'indigo',
      title: 'Перебудуємо 14 занять',
      text: 'З 11 вересня',
    },
    {
      id: 'lost',
      icon: <NotebookPenIcon />,
      tone: 'warning',
      title: '2 заняття втратять тему й нотатки',
      text: 'пт 18 вер · пт 2 жов',
    },
    { id: 'ok', icon: <CircleCheckIcon />, tone: 'success', title: 'Конфліктів немає' },
  ],
  statusFix: [
    {
      id: 'package',
      icon: <PackageIcon />,
      tone: 'indigo',
      title: 'Пакет не зміниться',
      text: 'Заняття лишається списаним з «B2 preparation» — залишок 5 з 8',
    },
    {
      id: 'miss',
      icon: <UserXIcon />,
      tone: 'danger',
      title: 'У статистиці з’явиться пропуск',
      text: 'В історії заняття буде запис про зміну статусу',
    },
    {
      id: 'scheduled',
      icon: <HistoryIcon />,
      tone: 'neutral',
      title: '«Заплановане» недоступне',
      text: 'Заняття вже минуло — повернути його в розклад не можна',
    },
  ],
  conflicts: [
    {
      id: 'rebuilt',
      icon: <RepeatIcon />,
      tone: 'indigo',
      title: 'Перебудуємо 14 занять',
      text: 'З 11 вересня',
    },
    {
      id: 'conflicts',
      icon: <TriangleAlertIcon />,
      tone: 'danger',
      title: '2 заняття перетнуться з іншими',
      text: 'пт 25 вер · пт 9 жов',
    },
  ],
};

type Args = { set: keyof typeof SETS };

/** "What will change" before a consequential action, with the numbers in the titles. */
function ImpactListStory({ set }: Args) {
  return (
    <div className="w-110 max-w-full">
      <ImpactList items={SETS[set]} label="Що зміниться" />
    </div>
  );
}

const meta = {
  title: 'Shared/Feedback/ImpactList',
  component: ImpactListStory,
  args: { set: 'move' },
  argTypes: { set: { control: 'inline-radio', options: ['move', 'statusFix', 'conflicts'] } },
} satisfies Meta<typeof ImpactListStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
