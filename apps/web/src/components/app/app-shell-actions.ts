export async function performLogout({
  logout,
  redirectToLogin,
  reportError,
}: {
  logout: () => Promise<void>;
  redirectToLogin: () => void;
  reportError: () => void;
}): Promise<boolean> {
  try {
    await logout();
  } catch {
    reportError();
    return false;
  }

  redirectToLogin();
  return true;
}
