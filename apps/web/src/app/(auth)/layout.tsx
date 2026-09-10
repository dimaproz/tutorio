import { LocaleSwitcher } from '@/components/locale-switcher';
import { AuthShell } from '@/features/auth';

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell localeControl={<LocaleSwitcher />}>{children}</AuthShell>;
}
