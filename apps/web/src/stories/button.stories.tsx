import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, fn } from 'storybook/test';
import type { GlyphName } from '@/components/shared/glyph';
import { Button } from '@/components/ui/button';
import { glyphControl, glyphNode } from './story-helpers';

type ButtonStoryArgs = {
  label: string;
  variant: 'primary' | 'outline' | 'white' | 'soft' | 'ghost' | 'danger' | 'dark-outline';
  size: 'xl' | 'default' | 'sm' | 'xs';
  icon: GlyphName | 'none';
  trailing: GlyphName | 'none';
  bubble: boolean;
  fill: boolean;
  disabled: boolean;
  onClick: () => void;
};

/**
 * The design's `Btn`: the shadcn Button with the Studio variants. Hover,
 * press (`scale .98`) and focus states come from the primitive itself.
 */
function ButtonStory({
  label,
  variant,
  size,
  icon,
  trailing,
  bubble,
  fill,
  disabled,
  onClick,
}: ButtonStoryArgs) {
  const leading = glyphNode(icon);
  const button = (
    <Button
      variant={variant}
      size={size}
      disabled={disabled}
      onClick={onClick}
      leading={bubble ? leading : undefined}
      className={fill ? 'w-full' : undefined}
    >
      {!bubble && leading ? <span data-icon="inline-start">{leading}</span> : null}
      {label}
      {trailing !== 'none' ? <span data-icon="inline-end">{glyphNode(trailing)}</span> : null}
    </Button>
  );

  // These variants belong on the highlight card, exactly as the next-lesson ticket uses them.
  return variant === 'dark-outline' || (variant === 'soft' && size === 'default') ? (
    <div className="w-fit rounded-block bg-feature p-5">{button}</div>
  ) : (
    button
  );
}

const meta = {
  title: 'Foundation/Button',
  component: ButtonStory,
  args: {
    label: 'Schedule lesson',
    variant: 'primary',
    size: 'default',
    icon: 'none',
    trailing: 'none',
    bubble: false,
    fill: false,
    disabled: false,
    onClick: fn(),
  },
  argTypes: {
    variant: {
      control: 'inline-radio',
      options: ['primary', 'outline', 'white', 'soft', 'ghost', 'danger', 'dark-outline'],
    },
    size: {
      control: 'inline-radio',
      options: ['xl', 'default', 'sm', 'xs'],
      description: 'xl 48 · default (md) 44 · sm 40 · xs 32',
    },
    icon: glyphControl,
    trailing: glyphControl,
    bubble: { description: 'Draws the leading icon in the round sky bubble.' },
    fill: { description: 'Stretches to the full width of the container.' },
  },
} satisfies Meta<typeof ButtonStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {
  play: async ({ canvas, args }) => {
    const button = canvas.getByRole('button', { name: args.label });
    await button.click();
    await expect(args.onClick).toHaveBeenCalled();
  },
};

/** The primary action with its bubble, as on "New student". */
export const WithBubble: Story = {
  args: { label: 'New student', size: 'xl', icon: 'plus', bubble: true },
};
