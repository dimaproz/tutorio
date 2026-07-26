import { describe, expect, it } from 'vitest';
import { registerFormSchema } from '@/features/auth/model/register-form';

const valid = {
  name: 'Olena',
  workspaceName: 'SpeakWise',
  email: 'olena@example.com',
  password: 'correct horse battery',
  confirmPassword: 'correct horse battery',
  mode: 'SCHOOL' as const,
};

describe('registerFormSchema (web-only)', () => {
  it('accepts matching passwords', () => {
    expect(registerFormSchema.safeParse(valid).success).toBe(true);
  });

  // Solo mode hides the workspace-name field, so the length rule has to move
  // onto the name the tutor can actually see and fix.
  it('validates the workspace name only in school mode', () => {
    const solo = { ...valid, mode: 'SOLO' as const, workspaceName: '' };
    expect(registerFormSchema.safeParse(solo).success).toBe(true);
    expect(registerFormSchema.safeParse({ ...valid, workspaceName: '' }).success).toBe(false);

    const shortSoloName = registerFormSchema.safeParse({ ...solo, name: 'O' });
    expect(shortSoloName.success).toBe(false);
    if (!shortSoloName.success) {
      expect(shortSoloName.error.issues.some((issue) => issue.path[0] === 'name')).toBe(true);
    }
  });

  it('rejects mismatched confirmation on the confirmPassword path', () => {
    const result = registerFormSchema.safeParse({ ...valid, confirmPassword: 'different pass' });
    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues.find((entry) => entry.path[0] === 'confirmPassword');
      expect(issue?.code).toBe('custom');
      const params = issue?.code === 'custom' ? (issue.params as { key?: string }) : undefined;
      expect(params?.key).toBe('confirmPasswordMismatch');
    }
  });

  it('keeps the shared password policy (12+ characters)', () => {
    const result = registerFormSchema.safeParse({
      ...valid,
      password: 'short',
      confirmPassword: 'short',
    });
    expect(result.success).toBe(false);
  });
});
