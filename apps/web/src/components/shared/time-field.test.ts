import { describe, expect, it } from 'vitest';
import { parseTimeInput, timeSteps } from './time-field';

describe('parseTimeInput', () => {
  it.each([
    ['1740', '17:40'],
    ['17:40', '17:40'],
    ['17.40', '17.40'.replace('.', ':')],
    ['9', '09:00'],
    ['930', '09:30'],
    ['17', '17:00'],
    ['9:5', '09:50'],
    [' 08 : 15 ', '08:15'],
    ['0000', '00:00'],
  ])('reads %s as %s', (raw, expected) => {
    expect(parseTimeInput(raw)).toBe(expected);
  });

  it.each(['', '25:00', '1760', '24', 'abc', '17:4a', '12345'])('refuses %s', (raw) => {
    expect(parseTimeInput(raw)).toBeNull();
  });
});

describe('timeSteps', () => {
  it('lists the day in steps', () => {
    expect(timeSteps(15)).toHaveLength(96);
    expect(timeSteps(30, 15, 17)).toEqual(['15:00', '15:30', '16:00', '16:30']);
  });
});
