import { describe, expect, it, vi } from 'vitest';
import { performLogout } from './app-shell-actions';

describe('performLogout', () => {
  it('redirects only after a successful logout mutation', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    const redirectToLogin = vi.fn();
    const reportError = vi.fn();

    await expect(performLogout({ logout, redirectToLogin, reportError })).resolves.toBe(true);
    expect(redirectToLogin).toHaveBeenCalledWith();
    expect(reportError).not.toHaveBeenCalled();
  });

  it('shows the existing error path and does not redirect when logout fails', async () => {
    const logout = vi.fn().mockRejectedValue(new Error('network failure'));
    const redirectToLogin = vi.fn();
    const reportError = vi.fn();

    await expect(performLogout({ logout, redirectToLogin, reportError })).resolves.toBe(false);
    expect(reportError).toHaveBeenCalledWith();
    expect(redirectToLogin).not.toHaveBeenCalled();
  });
});
