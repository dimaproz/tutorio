'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { AuthPromoLogin, AuthPromoRegister } from './auth-promo';

interface AuthShellProps {
  localeControl: ReactNode;
  children: ReactNode;
  /** Which promo panel accompanies the form; derived from the route by default. */
  variant?: 'login' | 'register';
}

function Logo({ compact = false }: { compact?: boolean }) {
  const t = useTranslations('common');
  return (
    <div className="flex items-center gap-2.5">
      <span
        aria-hidden="true"
        className={
          compact
            ? 'flex size-7.5 items-center justify-center rounded-[10px] bg-brand-soft text-lg font-bold text-brand-soft-foreground'
            : 'flex size-8.5 items-center justify-center rounded-logo bg-brand-soft text-xl font-bold text-brand-soft-foreground'
        }
      >
        t
      </span>
      <span
        className={
          compact
            ? 'text-[19px] font-semibold tracking-[-0.02em]'
            : 'text-[22px] font-semibold tracking-[-0.02em]'
        }
      >
        {t('appName').toLowerCase()}
      </span>
    </div>
  );
}

/** The dotted indigo ground with its two soft circles, shared by both layouts. */
function TintGround({ compact = false }: { compact?: boolean }) {
  return (
    <>
      <div
        aria-hidden="true"
        className={
          compact
            ? 'absolute inset-0 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand)_14%,transparent)_1.5px,transparent_1.6px)] bg-size-[22px_22px]'
            : 'absolute inset-0 bg-[radial-gradient(circle,color-mix(in_oklch,var(--brand)_14%,transparent)_1.5px,transparent_1.6px)] bg-size-[24px_24px]'
        }
      />
      <div
        aria-hidden="true"
        className={
          compact
            ? 'absolute -right-20 -bottom-30 size-65 rounded-pill bg-brand-soft opacity-55'
            : 'absolute -right-35 -bottom-40 size-130 rounded-pill bg-brand-soft opacity-55'
        }
      />
      {compact ? null : (
        <div
          aria-hidden="true"
          className="absolute -top-22.5 right-30 size-65 rounded-pill bg-card opacity-55"
        />
      )}
    </>
  );
}

/**
 * The authentication frame. Desktop: the form card (40%) beside an indigo
 * panel (60%) with a product collage. Phones: an indigo band with the headline and
 * the form card overlapping it by 40px.
 */
export function AuthShell({ localeControl, children, variant }: AuthShellProps) {
  const pathname = usePathname();
  const kind = variant ?? (pathname?.startsWith('/register') ? 'register' : 'login');
  const t = useTranslations(`auth.promo.${kind}`);

  return (
    <div className="flex min-h-svh flex-col bg-background text-foreground md:flex-row md:gap-4 md:p-4">
      {/* Phone band */}
      <section className="surface-light relative mx-3 mt-3 flex flex-col gap-5.5 overflow-hidden rounded-card bg-tint-indigo px-4.5 pt-4.5 pb-16 text-tint-foreground md:hidden">
        <TintGround compact />
        <div className="relative flex items-center justify-between">
          <Logo compact />
          {localeControl}
        </div>
        {/* Marketing copy is decoration: it must not be read before the form. */}
        <div aria-hidden="true" className="relative flex flex-col gap-3">
          <Badge variant="on-tint" size="lg">
            {t('chip')}
          </Badge>
          <p className="max-w-75 text-[26px] leading-[30px] font-semibold tracking-[-0.03em]">
            {t('headline')}
          </p>
        </div>
      </section>

      <main className="relative mx-3 -mt-10 mb-6 flex flex-col rounded-card border border-border bg-card px-5 py-6 md:m-0 md:grow md:px-12 md:py-9 lg:min-w-120 lg:grow-0 lg:basis-2/5 lg:px-10 xl:px-12">
        <div className="hidden items-center justify-between md:flex">
          <Logo />
          {localeControl}
        </div>
        <div className="flex grow flex-col justify-center">
          <div
            className={
              kind === 'register'
                ? 'flex w-full flex-col md:mx-auto md:max-w-130 md:py-8'
                : 'flex w-full flex-col md:mx-auto md:max-w-110 md:py-8'
            }
          >
            {children}
          </div>
        </div>
      </main>

      {/* Desktop panel: decoration and a headline, never needed to sign in.
          The split is 40 / 60; below lg the form card has the page alone. */}
      <section
        aria-hidden="true"
        className="surface-light relative hidden min-w-0 basis-3/5 flex-col justify-between gap-10 overflow-hidden rounded-hero bg-tint-indigo p-14 text-tint-foreground lg:flex"
      >
        <TintGround />
        <div className="relative flex max-w-145 flex-col gap-5">
          <Badge variant="on-tint" size="lg">
            {t('chip')}
          </Badge>
          <p
            className={
              kind === 'register'
                ? 'text-[52px] leading-[56px] font-semibold tracking-[-0.04em]'
                : 'text-[44px] leading-12 font-semibold tracking-[-0.04em]'
            }
          >
            {t('headline')}
          </p>
        </div>
        <div className="relative">
          {kind === 'register' ? <AuthPromoRegister /> : <AuthPromoLogin />}
        </div>
      </section>
    </div>
  );
}
