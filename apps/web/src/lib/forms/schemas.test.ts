import { describe, expect, it } from 'vitest';
import { registerFormSchema } from './schemas';

const valid = {
  name: 'Olena',
  workspaceName: 'SpeakWise',
  email: 'olena@example.com',
  password: 'correct horse battery',
  confirmPassword: 'correct horse battery',
};

describe('registerFormSchema (web-only)', () => {
  it('accepts matching passwords', () => {
    expect(registerFormSchema.safeParse(valid).success).toBe(true);
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
