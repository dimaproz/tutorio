import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent, waitFor, within } from 'storybook/test';
import { UserRoundIcon } from 'lucide-react';
import { FormSection } from '@/components/app/form-section';
import { EntityFormDialog } from '@/components/shared/entity-form-dialog';
import { FormActions } from '@/components/shared/form-actions';
import { Button } from '@/components/ui/button';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { NarrowStoryContainer } from './story-helpers';

function EntityFormDialogContract({ initiallyOpen = false, isLoading = false }: { initiallyOpen?: boolean; isLoading?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);

  return (
    <>
      <Button onClick={() => setOpen(true)}>Add student</Button>
      <EntityFormDialog
        open={open}
        onOpenChange={setOpen}
        title="New student"
        description="Only the name and timezone are required."
        isLoading={isLoading}
      >
        <div className="flex flex-col gap-6">
          <FormSection icon={UserRoundIcon} title="Basic information" description="Use the student's preferred full name.">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="student-full-name">Full name</FieldLabel>
                <Input id="student-full-name" placeholder="Anna Shevchenko" />
              </Field>
            </FieldGroup>
          </FormSection>
          <FormActions>
            <Button variant="outline" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button">Create student</Button>
          </FormActions>
        </div>
      </EntityFormDialog>
    </>
  );
}

const meta = {
  title: 'Shared/EntityFormDialog',
  component: EntityFormDialogContract,
} satisfies Meta<typeof EntityFormDialogContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Closed: Story = {};

export const Open: Story = {
  args: { initiallyOpen: true },
};

export const Loading: Story = {
  args: { initiallyOpen: true, isLoading: true },
};

export const NarrowMobile: Story = {
  render: () => (
    <NarrowStoryContainer>
      <EntityFormDialogContract initiallyOpen />
    </NarrowStoryContainer>
  ),
};

export const OpensAndCancels: Story = {
  play: async ({ canvas }) => {
    await userEvent.click(canvas.getByRole('button', { name: 'Add student' }));
    await waitFor(() => expect(within(document.body).getByRole('dialog')).toBeVisible());
    await userEvent.click(within(document.body).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(within(document.body).queryByRole('dialog')).not.toBeVisible());
  },
};
