import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { CreditMeter } from '@/components/shared/credit-meter';

type Args = { left: number; total: number; size: 'sm' | 'lg'; inline: boolean };

/**
 * Credits as one pill per lesson: brand for the credits left, a faint ink for
 * the used ones. At two or fewer left the `sm` meter turns coral; with no
 * package it says so. `inline` is the lesson form's pill ("5 з 8 у пакеті").
 * Captions come from the students copy.
 */
function CreditMeterStory({ left, total, size, inline }: Args) {
  const t = useTranslations('students.list');
  const tMetrics = useTranslations('students.profileMetrics');
  const label =
    total === 0
      ? t('noPackage')
      : left === 0
        ? t('noCreditsLeft')
        : t('creditsLeft', { left, total });

  return size === 'lg' ? (
    <div className="w-80 rounded-block bg-tint-info p-5 text-tint-info-foreground">
      <CreditMeter
        size="lg"
        left={left}
        total={total}
        usedLabel={tMetrics('used', { count: total - left })}
        leftLabel={label}
      />
    </div>
  ) : (
    <div className="w-fit rounded-block bg-card p-5">
      {inline ? (
        <span className="inline-flex h-6.5 items-center rounded-pill bg-background px-2.5">
          <CreditMeter inline left={left} total={total} label={label} />
        </span>
      ) : (
        <CreditMeter left={left} total={total} label={label} />
      )}
    </div>
  );
}

const meta = {
  title: 'Shared/Base/CreditMeter',
  component: CreditMeterStory,
  args: { left: 6, total: 8, size: 'sm', inline: false },
  argTypes: {
    left: { control: { type: 'range', min: 0, max: 20 } },
    total: { control: { type: 'range', min: 0, max: 20 } },
    size: { control: 'inline-radio', options: ['sm', 'lg'] },
    inline: { control: 'boolean' },
  },
} satisfies Meta<typeof CreditMeterStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const RunningLow: Story = { args: { left: 1, total: 8 } };
