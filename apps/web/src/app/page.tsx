import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { REFRESH_COOKIE } from '@/lib/auth/cookies';

// Optimistic entry point: route by session-cookie presence. The protected
// shell still validates the session against the API.
export default async function RootPage() {
  const store = await cookies();
  redirect(store.has(REFRESH_COOKIE) ? '/app' : '/login');
}
