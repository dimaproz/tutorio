// Runs before any module is imported (jest setupFiles). Raises the auth rate
// limits so the suite is not throttled, and provides JWT secrets when the
// environment (e.g. CI) has not set them.
process.env.THROTTLE_AUTH_LIMIT = process.env.THROTTLE_AUTH_LIMIT ?? '1000';
process.env.THROTTLE_REFRESH_LIMIT =
  process.env.THROTTLE_REFRESH_LIMIT ?? '1000';
process.env.JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET ?? 'e2e-access-secret-e2e-access-secret-00000';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ?? 'e2e-refresh-secret-e2e-refresh-secret-111';
