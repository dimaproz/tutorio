import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { StickyNoteIcon } from 'lucide-react';
import { FormSection } from '@/components/shared/form-section';
import { FormActions } from '@/components/shared/form-actions';
import { Button } from '@/components/ui/button';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NarrowStoryContainer } from './story-helpers';

function FormCompositionContract({
  invalid = false,
  submitting = false,
}: {
  invalid?: boolean;
  submitting?: boolean;
}) {
  return (
    <form className="flex max-w-xl flex-col gap-6">
      <FormSection
        icon={StickyNoteIcon}
        title="Notes"
        description="Optional context for the next lesson."
      >
        <FieldGroup>
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor="lesson-note">Note</FieldLabel>
            <Input
              id="lesson-note"
              aria-invalid={invalid || undefined}
              placeholder="Goals and preferences"
            />
            {invalid ? <FieldError>Add a reason before saving.</FieldError> : null}
          </Field>
        </FieldGroup>
      </FormSection>
      <FormActions>
        <Button type="button" variant="outline">
          Cancel
        </Button>
        <Button type="submit" disabled={submitting}>
          {submitting ? 'Saving changes' : 'Save changes'}
        </Button>
      </FormActions>
    </form>
  );
}

const meta = {
  title: 'Shared/FormSection and FormActions',
  component: FormCompositionContract,
} satisfies Meta<typeof FormCompositionContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const ValidationError: Story = {
  args: { invalid: true },
};

export const Loading: Story = {
  args: { submitting: true },
};

export const NarrowMobile: Story = {
  render: () => (
    <NarrowStoryContainer>
      <FormCompositionContract />
    </NarrowStoryContainer>
  ),
};
