import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { FormSectionCard, FormSectionHeader } from '@/components/shared/form-section';
import { Glyph, type GlyphName } from '@/components/shared/glyph';
import { TextField } from '@/components/shared/text-field';
import { glyphControl } from '../story-helpers';

type Args = {
  glyph: GlyphName;
  title: string;
  description: string;
  tag: 'required' | 'optional' | 'none';
  asCard: boolean;
  invalid: boolean;
  dimmed: boolean;
};

/** A form section heading, alone or as the whole section card. */
function FormSectionHeaderStory({ glyph, title, description, tag, asCard, invalid, dimmed }: Args) {
  const tagProp =
    tag === 'none' ? undefined : { label: tag === 'required' ? 'required' : 'optional', tone: tag };

  if (!asCard) {
    return (
      <div className="w-160 max-w-full rounded-block bg-card p-6">
        <FormSectionHeader
          icon={<Glyph name={glyph} />}
          title={title}
          description={description || undefined}
          tag={tagProp}
        />
      </div>
    );
  }

  return (
    <div className="w-160 max-w-full">
      <FormSectionCard
        id="story-section"
        icon={<Glyph name={glyph} />}
        title={title}
        description={description || undefined}
        tag={tagProp}
        invalid={invalid}
        dimmed={dimmed}
      >
        <TextField
          label="Full name"
          required
          placeholder="e.g. Anna Shevchenko"
          error={invalid ? 'Enter the student’s name' : undefined}
          disabled={dimmed}
        />
      </FormSectionCard>
    </div>
  );
}

const meta = {
  title: 'Shared/Form/FormSectionHeader',
  component: FormSectionHeaderStory,
  args: {
    glyph: 'user',
    title: 'Personal details',
    description: 'Avatar and name',
    tag: 'required',
    asCard: false,
    invalid: false,
    dimmed: false,
  },
  argTypes: {
    glyph: { ...glyphControl, options: glyphControl.options.filter((name) => name !== 'none') },
    tag: { control: 'inline-radio', options: ['required', 'optional', 'none'] },
    asCard: { description: 'Renders the full FormSectionCard around a field.' },
    invalid: { if: { arg: 'asCard' } },
    dimmed: { if: { arg: 'asCard' }, description: 'The read-only archived section.' },
  },
} satisfies Meta<typeof FormSectionHeaderStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Playground: Story = {};

export const SectionCard: Story = { args: { asCard: true } };
