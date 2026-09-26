import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn, userEvent, within } from 'storybook/test';
import type { AvatarKeyDto, LessonResponse } from '@tutorio/validation';
import { zonedIso } from '@/lib/datetime';
import { TEACHER_COLORS } from '@/lib/theme/user-colors';
import { StoryClock } from '@/stories/story-helpers';
import { lessonFixture } from '../model/testing';
import { TimedLessonRow } from './timed-lesson-row';

/** Saturday 26 September 2026, 13:05 Kyiv: the S11 boards' clock. */
const NOW = Date.parse(zonedIso('2026-09-26', '13:05', 'Europe/Kyiv'));
const at = (time: string) => zonedIso('2026-09-26', time, 'Europe/Kyiv');
const TEACHERS = {
  olena: {
    id: '55555555-5555-4555-8555-000000000001',
    name: 'Olena Kovalenko',
    color: TEACHER_COLORS[4],
  },
  dmytro: {
    id: '55555555-5555-4555-8555-000000000002',
    name: 'Dmytro Tutor',
    color: TEACHER_COLORS[0],
  },
  iryna: {
    id: '55555555-5555-4555-8555-000000000003',
    name: 'Iryna Bondar',
    color: TEACHER_COLORS[1],
  },
  oleh: {
    id: '55555555-5555-4555-8555-000000000004',
    name: 'Oleh Marchenko',
    color: TEACHER_COLORS[2],
  },
};

let n = 0;
const charge = (paid: boolean, source: 'PACKAGE' | 'DEBT' | 'BALANCE' = 'BALANCE') => ({
  id: `c0000000-0000-4000-8000-${String((n += 1)).padStart(12, '0')}`,
  enrollmentId: '66666666-6666-4666-8666-000000000001',
  source,
  packageId: null,
  amountMinor: 50000,
  currency: 'UAH' as const,
  paid,
  student: { id: 'd6bf671d-7a0f-4cf3-8a67-000000000001', fullName: 'Student' },
});
const person = (fullName: string, avatarKey: AvatarKeyDto) => ({
  id: `d6bf671d-7a0f-4cf3-8a67-${String((n += 1)).padStart(12, '0')}`,
  fullName,
  avatarKey,
});
const lesson = (time: string, fields: Partial<LessonResponse> = {}): LessonResponse =>
  lessonFixture({
    id: `88888888-8888-4888-8888-${String((n += 1)).padStart(12, '0')}`,
    startsAtUtc: at(time),
    teacher: TEACHERS.olena,
    ...fields,
  });
const group = (name: string, members: number) => ({
  student: null,
  enrollmentId: null,
  groupId: '99999999-9999-4999-8999-000000000001',
  group: { id: '99999999-9999-4999-8999-000000000001', name },
  groupMembers: members,
});

/** Board 03 «Усі типи й стани», in its order. */
const CATALOGUE: {
  label: string;
  lesson: LessonResponse;
  pkg?: { left: number; total: number };
}[] = [
  {
    label: 'Individual',
    lesson: lesson('18:30', {
      student: person('Petro Ivanenko', 'user-2'),
      topic: 'Business English',
    }),
    pkg: { left: 5, total: 8 },
  },
  {
    label: 'Group',
    lesson: lesson('19:15', { ...group('Beginners', 4), topic: 'Present Perfect' }),
  },
  {
    label: 'Makeup',
    lesson: lesson('16:00', {
      kind: 'MAKEUP',
      student: person('Olha Marchuk', 'user-5'),
      originalStartsAtUtc: zonedIso('2026-09-19', '16:00', 'Europe/Kyiv'),
    }),
    pkg: { left: 6, total: 8 },
  },
  {
    label: 'Past, held',
    lesson: lesson('10:00', {
      status: 'COMPLETED',
      student: person('Petro Ivanenko', 'user-2'),
      topic: 'Business English',
      charges: [charge(true, 'PACKAGE')],
    }),
  },
  {
    label: 'Now',
    lesson: lesson('12:30', {
      student: person('Roman Kyrylenko', 'user-8'),
      topic: 'Speaking: travel',
    }),
  },
  {
    label: 'Ahead',
    lesson: lesson('14:30', { student: person('Iryna Moroz', 'user-7'), topic: 'IELTS Writing' }),
  },
  {
    label: 'Group, attendance not marked',
    lesson: lesson('11:15', {
      ...group('Beginners', 4),
      status: 'COMPLETED',
      topic: 'Present Perfect',
      attendance: { present: 4, marked: 4, confirmed: false },
      charges: [charge(true), charge(false)],
    }),
  },
  {
    label: 'No-show',
    lesson: lesson('09:00', {
      status: 'NO_SHOW',
      student: person('Maksym Boiko', 'user-10'),
      topic: 'Grammar',
    }),
  },
  {
    label: 'Cancelled by the student',
    lesson: lesson('17:00', {
      status: 'CANCELLED_UNCHARGED',
      cancelledBy: 'STUDENT',
      student: person('Nazar Shevchuk', 'user-9'),
      topic: 'Grammar',
    }),
  },
  {
    label: 'Late cancel, charged',
    lesson: lesson('15:00', {
      status: 'CANCELLED_CHARGED',
      cancelledBy: 'STUDENT',
      student: person('Mila Savchuk', 'user-4'),
      topic: 'Speaking',
    }),
  },
  {
    label: 'Cancelled by the teacher',
    lesson: lesson('19:00', {
      status: 'CANCELLED_UNCHARGED',
      cancelledBy: 'TEACHER',
      student: person('Taras Bondarenko', 'user-3'),
      topic: 'IELTS Reading',
    }),
  },
  {
    label: 'Unpaid',
    lesson: lesson('07:30', {
      status: 'COMPLETED',
      student: person('Iryna Moroz', 'user-7'),
      topic: 'IELTS Writing',
      charges: [charge(false)],
    }),
  },
  {
    label: 'Package running out',
    lesson: lesson('13:30', { student: person('Yana Lysenko', 'user-1'), topic: 'Français A1' }),
    pkg: { left: 1, total: 8 },
  },
  {
    label: 'Group, 90 min',
    lesson: lesson('08:00', {
      ...group('Business B2', 5),
      durationMin: 90,
      status: 'COMPLETED',
      topic: 'Negotiations',
      attendance: { present: 5, marked: 5, confirmed: true },
      charges: [charge(true), charge(true), charge(true), charge(false), charge(false)],
    }),
  },
  {
    label: 'Moved',
    lesson: lesson('17:00', {
      student: person('Oleh Melnyk', 'user-6'),
      topic: 'Grammar',
      rescheduledCount: 1,
    }),
    pkg: { left: 4, total: 8 },
  },
];

type Args = {
  sample: number;
  dense: boolean;
  showTeacher: boolean;
  catalogue: boolean;
  onOpen: (id: string) => void;
  onMarkAttendance: (id: string) => void;
};

/**
 * `TimedLessonRow` (S11 board 03): a lesson as the shared `LessonTimeRow` —
 * its kind as the group tile or the makeup chip, never a colour; the one
 * badge on desktop, the one mark on a dense (phone calendar) row; the time
 * tinted with the teacher's colour where several teachers are shown.
 * `catalogue` lays out every type and state, desktop and dense side by side.
 */
function TimedLessonRowStory({
  sample,
  dense,
  showTeacher,
  catalogue,
  onOpen,
  onMarkAttendance,
}: Args) {
  const teacherOf = (index: number) =>
    showTeacher ? Object.values(TEACHERS)[index % 4]! : TEACHERS.olena;
  const row = (index: number, isDense: boolean) => {
    const item = CATALOGUE[index]!;
    return (
      <TimedLessonRow
        lesson={{ ...item.lesson, teacher: teacherOf(index) }}
        nowMs={NOW}
        dense={isDense}
        showTeacher={showTeacher}
        pkg={item.pkg ?? null}
        lowCreditThreshold={2}
        onOpen={onOpen}
        onMarkAttendance={onMarkAttendance}
      />
    );
  };
  return (
    <StoryClock now={NOW}>
      {catalogue ? (
        <div className="grid w-[1180px] grid-cols-[180px_minmax(0,1fr)_380px] items-center gap-x-6 gap-y-2.5 rounded-card bg-card p-6">
          {CATALOGUE.map((item, index) => (
            <div key={item.label} className="contents">
              <span className="text-sm text-muted-foreground">{item.label}</span>
              {row(index, false)}
              <div className="rounded-item bg-background p-1">{row(index, true)}</div>
            </div>
          ))}
        </div>
      ) : (
        <div
          className={dense ? 'w-97 bg-background p-3' : 'w-170 max-w-full rounded-card bg-card p-4'}
        >
          {row(sample, dense)}
        </div>
      )}
    </StoryClock>
  );
}

const meta = {
  title: 'Lessons/Patterns/TimedLessonRow',
  component: TimedLessonRowStory,
  args: {
    sample: 4,
    dense: false,
    showTeacher: false,
    catalogue: false,
    onOpen: fn(),
    onMarkAttendance: fn(),
  },
  argTypes: {
    sample: {
      control: 'select',
      options: CATALOGUE.map((_, index) => index),
      labels: Object.fromEntries(CATALOGUE.map((item, index) => [index, item.label])),
    },
  },
} satisfies Meta<typeof TimedLessonRowStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    await userEvent.click(canvas.getByRole('button', { name: /Roman Kyrylenko/ }));
    await expect(args.onOpen).toHaveBeenCalledTimes(1);
  },
};

/** Board 03 01–03: every type and state, desktop and dense. */
export const Catalogue: Story = { args: { catalogue: true } };

/** A finished group lesson nobody marked asks «Відмітити», which opens S01 on attendance. */
export const MarkAttendance: Story = {
  args: { sample: 6 },
  play: async ({ canvasElement, args }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByRole('button', { name: /^(Відмітити|Mark)$/ }));
    await expect(args.onMarkAttendance).toHaveBeenCalledTimes(1);
    await expect(args.onOpen).not.toHaveBeenCalled();
  },
};
