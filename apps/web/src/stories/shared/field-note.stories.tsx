import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { ArrowLeftRightIcon, HourglassIcon, RepeatIcon, TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { FieldNote } from '@/components/shared/field-note';

type Args = { variant: 'schedule' | 'warning' | 'band' | 'substitution' };

/**
 * A one-line explanation beside a field: the schedule line of the edit form,
 * a busy teacher or an overlap (warning), the package note under the picked
 * student in the band, and the sky strip of a substitute teacher with its
 * «Повернути» link.
 */
function FieldNoteStory({ variant }: Args) {
  const t = useTranslations('lessons.fields');
  const tCreate = useTranslations('lessons.create');
  const note = {
    schedule: <FieldNote icon={<RepeatIcon />}>{t('scheduleLine')}</FieldNote>,
    warning: (
      <FieldNote tone="warning" icon={<TriangleAlertIcon />}>
        {t('teacherBusyNote', { time: '17:00', name: 'B1 English' })}
      </FieldNote>
    ),
    band: (
      <div className="rounded-block bg-tint-indigo p-4">
        <FieldNote tone="brand" icon={<HourglassIcon />}>
          {tCreate('noteRunningOut', { covered: 1, price: '500 ₴' })}
        </FieldNote>
      </div>
    ),
    substitution: (
      <FieldNote
        appearance="strip"
        icon={<ArrowLeftRightIcon />}
        action={
          <Button type="button" variant="link" size="xs" className="h-auto px-0 font-semibold">
            {t('substitutionRestore')}
          </Button>
        }
      >
        {t.rich('substitution', {
          name: 'Dmytro Tutor',
          b: (chunks) => <strong className="font-semibold">{chunks}</strong>,
        })}
      </FieldNote>
    ),
  }[variant];
  return <div className="w-150 max-w-full">{note}</div>;
}

const meta = {
  title: 'Shared/Form/FieldNote',
  component: FieldNoteStory,
  args: { variant: 'substitution' },
  argTypes: {
    variant: { control: 'inline-radio', options: ['schedule', 'warning', 'band', 'substitution'] },
  },
} satisfies Meta<typeof FieldNoteStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
