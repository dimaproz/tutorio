import { describe, expect, it } from 'vitest';
import { selectedPresetValue } from './preset-number-input';

describe('selectedPresetValue', () => {
  it('keeps preset values selected and allows arbitrary manual values', () => {
    expect(selectedPresetValue('8', [4, 8, 16, 20])).toBe('8');
    expect(selectedPresetValue('13', [4, 8, 16, 20])).toBe('');
  });
});
