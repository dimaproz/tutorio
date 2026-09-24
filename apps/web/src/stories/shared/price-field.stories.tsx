import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { PackageIcon } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PriceField } from '@/components/shared/price-field';

const STATES = [
  'rate',
  'byHand',
  'teacherChanged',
  'oneOff',
  'package',
  'empty',
  'group',
  'paid',
  'error',
] as const;

type Args = { state: (typeof STATES)[number] };

/**
 * The lesson price (board FieldsTeacher), in every state the form reaches:
 * the student's rate, changed by hand with «Повернути ставку», updated after
 * a substitute teacher, one-off, a package lesson (a credit, no money), not
 * picked yet, the group price per member, a paid lesson and an error.
 */
function PriceFieldStory({ state }: Args) {
  const t = useTranslations('lessons.fields');
  const tValidation = useTranslations('validation');
  const initial = { byHand: '450', teacherChanged: '450', group: '400', error: '-50' } as const;
  const [value, setValue] = useState<string>((initial as Record<string, string>)[state] ?? '500');
  const common = { value, onChange: setValue, currency: '₴' };
  const view = {
    rate: { hint: t('priceRate', { student: 'Anna', teacher: 'Dmytro Tutor' }) },
    byHand: {
      hint: t('priceByHand', { rate: '500 ₴' }),
      labelAction: (
        <Button type="button" variant="link" size="xs" className="h-auto px-0">
          {t('priceRestore')}
        </Button>
      ),
    },
    teacherChanged: {
      hint: t('priceUpdatedHint', { student: 'Anna', teacher: 'Iryna Bondar', was: '500 ₴' }),
      labelAction: <Badge variant="info">{t('priceUpdated')}</Badge>,
    },
    oneOff: { hint: t('priceOneOff', { student: 'Anna' }) },
    package: {
      state: 'package' as const,
      packageLabel: t('pricePackage', { count: 1 }),
      packageIcon: <PackageIcon />,
      hint: t('pricePackageLeft', { left: 5, total: 8 }),
    },
    empty: { state: 'empty' as const, hint: t('priceEmpty') },
    group: { label: t('pricePerMember'), hint: t('priceGroup') },
    paid: { state: 'locked' as const, hint: t('pricePaid') },
    error: { error: tValidation('priceNegative') },
  }[state];
  return (
    <div className="w-80 max-w-full">
      <PriceField label={t('price')} {...common} {...view} />
    </div>
  );
}

const meta = {
  title: 'Shared/Form/PriceField',
  component: PriceFieldStory,
  args: { state: 'rate' },
  argTypes: { state: { control: 'select', options: STATES } },
} satisfies Meta<typeof PriceFieldStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
