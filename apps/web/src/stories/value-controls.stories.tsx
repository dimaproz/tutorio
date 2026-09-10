import { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import { expect, userEvent } from 'storybook/test';
import type { AvatarKeyDto } from '@tutorio/validation';
import { AppointmentField } from '@/components/shared/appointment-picker';
import { AvatarPicker } from '@/components/shared/avatar-picker';
import { CurrencyOption } from '@/components/shared/currency-option';
import { DatePicker } from '@/components/shared/date-picker';
import { DurationInput } from '@/components/shared/duration-input';
import { MoneyInput } from '@/components/shared/money-input';
import { TimezoneCombobox } from '@/components/shared/timezone-combobox';
import { WeekdayPicker } from '@/components/shared/weekday-picker';
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { NarrowStoryContainer } from './story-helpers';

const currencies = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'];

function ValueControlsContract() {
  const [avatar, setAvatar] = useState<AvatarKeyDto | null>(null);
  const [price, setPrice] = useState('30');
  const [currency, setCurrency] = useState('EUR');
  const [duration, setDuration] = useState('60');
  const [timezone, setTimezone] = useState('Europe/Kyiv');
  const [date, setDate] = useState('2026-09-10');
  const [appointment, setAppointment] = useState('2026-09-11T10:00');
  const [weekdays, setWeekdays] = useState([1, 3, 5]);

  return (
    <div className="max-w-2xl">
      <FieldGroup>
        <Field>
          <FieldLabel>Avatar</FieldLabel>
          <AvatarPicker
            value={avatar}
            onChange={setAvatar}
            fullName="Anna Shevchenko"
            initialsLabel="Use initials"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-price">Price</FieldLabel>
          <div className="grid gap-3 sm:grid-cols-[1fr_10rem]">
            <MoneyInput
              id="reference-price"
              aria-label="Price"
              value={price}
              onChange={(event) => setPrice(event.target.value)}
            />
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger aria-label="Currency">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  {currencies.map((code) => (
                    <SelectItem key={code} value={code}>
                      <CurrencyOption code={code} />
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-duration">Duration</FieldLabel>
          <DurationInput id="reference-duration" value={duration} onValueChange={setDuration} />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-timezone">Timezone</FieldLabel>
          <TimezoneCombobox
            id="reference-timezone"
            value={timezone}
            onChange={setTimezone}
            placeholder="Select timezone"
            searchPlaceholder="Search timezones"
            emptyLabel="No timezone found"
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-date">Date</FieldLabel>
          <DatePicker id="reference-date" value={date} onChange={setDate} />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-appointment">Appointment</FieldLabel>
          <AppointmentField
            id="reference-appointment"
            value={appointment}
            onChange={setAppointment}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="reference-weekdays">Weekdays</FieldLabel>
          <WeekdayPicker id="reference-weekdays" value={weekdays} onChange={setWeekdays} />
        </Field>
      </FieldGroup>
    </div>
  );
}

const meta = {
  title: 'Shared/Value controls',
  component: ValueControlsContract,
} satisfies Meta<typeof ValueControlsContract>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  play: async ({ canvas }) => {
    const price = canvas.getByRole('textbox', { name: 'Price' });
    await userEvent.clear(price);
    await userEvent.type(price, '12ab.34');
    await expect(price).toHaveValue('12.34');
  },
};

export const NarrowMobile: Story = {
  render: () => (
    <NarrowStoryContainer>
      <ValueControlsContract />
    </NarrowStoryContainer>
  ),
};
