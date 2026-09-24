import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { useTranslations } from 'next-intl';
import { CalendarPlusIcon, PencilIcon, XIcon } from 'lucide-react';
import { IconButton } from '@/components/shared/icon-button';
import { BandHeader, TintBand } from '@/components/shared/tint-band';

type Args = { mode: 'create' | 'edit' };

/**
 * The indigo band that heads the lesson windows: the brand rings in the
 * corner, and in a form the header row — a white icon tile, the title and a
 * subtitle, close on the right. The tile hides on phones.
 */
function TintBandStory({ mode }: Args) {
  const t = useTranslations('lessons');
  return (
    <div className="w-160 max-w-full overflow-hidden rounded-hero">
      <TintBand>
        <BandHeader
          icon={mode === 'create' ? <CalendarPlusIcon /> : <PencilIcon />}
          title={
            <h2 className="text-xl leading-[26px] font-semibold tracking-[-0.01em]">
              {mode === 'create' ? t('create.title') : t('edit.title')}
            </h2>
          }
          subtitle={mode === 'create' ? t('create.subtitleEmpty') : t('panel.kind.individual')}
          actions={
            <IconButton icon={<XIcon />} label={t('panel.close')} size={38} tone="surface" />
          }
        />
      </TintBand>
    </div>
  );
}

const meta = {
  title: 'Shared/Cards/TintBand',
  component: TintBandStory,
  args: { mode: 'create' },
  argTypes: { mode: { control: 'inline-radio', options: ['create', 'edit'] } },
} satisfies Meta<typeof TintBandStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};
