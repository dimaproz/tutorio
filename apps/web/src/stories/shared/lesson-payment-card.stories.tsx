import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import {
  BanknoteIcon,
  CheckIcon,
  CircleSlashIcon,
  HourglassIcon,
  PackagePlusIcon,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LessonPaymentCard, type PaymentSegment } from '@/components/shared/lesson-payment-card';

type Variant =
  | 'package'
  | 'packageRunningOut'
  | 'packageNoShow'
  | 'paidOneOff'
  | 'unpaidOneOff'
  | 'upcomingOneOff'
  | 'makeup';

type Args = { variant: Variant; left: number; total: number };

function meter(total: number, left: number, current: PaymentSegment): PaymentSegment[] {
  const used = Math.max(total - left - 1, 0);
  return Array.from({ length: total }, (_, index) =>
    index < used ? 'used' : index === used ? current : 'available',
  );
}

/**
 * How one lesson is paid, as the lesson panel's right column shows it. Each
 * `variant` is one payment state of the S01 handoff; `left` and `total` drive
 * the package meter.
 */
function LessonPaymentCardStory({ variant, left, total }: Args) {
  const packageLine = '«B2 preparation» · 4 000 ₴ · до 30 листопада';
  const card = {
    package: (
      <LessonPaymentCard
        tone="indigo"
        art="rings"
        label="Оплата · пакет"
        badge={
          <Badge variant="on-tint">
            <CheckIcon data-icon="inline-start" />
            Пакет оплачено
          </Badge>
        }
        figure={{
          value: String(left),
          unit: `з ${total}`,
          caption: 'занять залишиться після цього',
          kind: 'count',
        }}
        segments={meter(total, left, 'current')}
        detail={packageLine}
        legend={{ segment: 'current', label: 'це заняття' }}
      />
    ),
    packageRunningOut: (
      <LessonPaymentCard
        tone="indigo"
        art="rings"
        label="Оплата · пакет"
        badge={
          <Badge variant="warning">
            <HourglassIcon data-icon="inline-start" />
            Останнє в пакеті
          </Badge>
        }
        figure={{
          value: '0',
          unit: `з ${total}`,
          caption: 'занять залишиться після цього',
          kind: 'count',
        }}
        segments={meter(total, 0, 'current')}
        detail={packageLine}
        legend={{ segment: 'current', label: 'це заняття' }}
        footer={{
          text: 'Наступне заняття, 15 вересня, пакет уже не покриє',
          action: (
            <Button type="button" variant="white" size="xs">
              <PackagePlusIcon data-icon="inline-start" />
              Запропонувати пакет
            </Button>
          ),
        }}
      />
    ),
    packageNoShow: (
      <LessonPaymentCard
        tone="indigo"
        art="rings"
        label="Оплата · пакет"
        badge={<Badge variant="danger">Списано: не прийшов</Badge>}
        figure={{
          value: String(left),
          unit: `з ${total}`,
          caption: 'занять залишилось у пакеті',
          kind: 'count',
        }}
        segments={meter(total, left, 'charged')}
        detail={packageLine}
        legend={{ segment: 'charged', label: 'пропуск' }}
      />
    ),
    paidOneOff: (
      <LessonPaymentCard
        tone="success"
        art="check"
        label="Оплата · разове заняття"
        figure={{ value: '500', unit: '₴', kind: 'money' }}
        chips={
          <Badge variant="on-tint">
            <CheckIcon data-icon="inline-start" />
            Оплачено 12 вересня
          </Badge>
        }
      />
    ),
    unpaidOneOff: (
      <LessonPaymentCard
        tone="warning"
        art="cards"
        label="Оплата · разове заняття"
        figure={{ value: '500', unit: '₴', kind: 'money' }}
        text="Списано 4 вересня · ще не оплачено"
        action={
          <Button type="button" variant="white" size="xs">
            <BanknoteIcon data-icon="inline-start" />
            Внести оплату
          </Button>
        }
      />
    ),
    upcomingOneOff: (
      <LessonPaymentCard
        tone="sky"
        art="cards"
        label="Оплата · разове заняття"
        figure={{ value: '500', unit: '₴', kind: 'money' }}
        text="Спишеться після заняття, 11 вересня о 18:00"
      />
    ),
    makeup: (
      <LessonPaymentCard
        tone="sky"
        art="check"
        label="Оплата · відпрацювання"
        badge={
          <Badge variant="on-tint">
            <CircleSlashIcon data-icon="inline-start" />
            Без списання
          </Badge>
        }
        headline="Безкоштовне"
        text="Оригінал 11 вересня вже списано — списується тільки одне з двох."
      />
    ),
  }[variant];

  return <div className="w-100 max-w-full">{card}</div>;
}

const meta = {
  title: 'Shared/Cards/LessonPaymentCard',
  component: LessonPaymentCardStory,
  args: { variant: 'package', left: 5, total: 8 },
  argTypes: {
    variant: {
      control: 'select',
      options: [
        'package',
        'packageRunningOut',
        'packageNoShow',
        'paidOneOff',
        'unpaidOneOff',
        'upcomingOneOff',
        'makeup',
      ],
    },
    left: { control: { type: 'range', min: 0, max: 12 } },
    total: { control: { type: 'range', min: 1, max: 12 } },
  },
} satisfies Meta<typeof LessonPaymentCardStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
