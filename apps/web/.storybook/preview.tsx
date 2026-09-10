import type { Preview } from '@storybook/nextjs-vite';
import { useEffect, type ReactNode } from 'react';
import { NextIntlClientProvider } from 'next-intl';
import enMessages from '../messages/en.json';
import ukMessages from '../messages/uk.json';
import { fontVariableClasses } from '../src/lib/fonts';
import '../src/app/globals.css';

const messages = {
  en: enMessages,
  uk: ukMessages,
};

function StoryEnvironment({
  children,
  isDark,
  locale,
}: {
  children: ReactNode;
  isDark: boolean;
  locale: 'en' | 'uk';
}) {
  useEffect(() => {
    const root = document.documentElement;
    const previousLanguage = root.lang;
    const previouslyDark = root.classList.contains('dark');
    const fontClasses = fontVariableClasses.split(' ');

    root.lang = locale;
    root.classList.add(...fontClasses);
    root.classList.toggle('dark', isDark);

    return () => {
      root.lang = previousLanguage;
      root.classList.remove(...fontClasses);
      root.classList.toggle('dark', previouslyDark);
    };
  }, [isDark, locale]);

  return children;
}

const preview: Preview = {
  tags: ['autodocs', 'test'],
  globalTypes: {
    locale: {
      description: 'Tutorio interface locale',
      toolbar: {
        icon: 'globe',
        items: [
          { value: 'en', title: 'English' },
          { value: 'uk', title: 'Ukrainian' },
        ],
      },
    },
    theme: {
      description: 'Tutorio color theme',
      toolbar: {
        icon: 'mirror',
        items: [
          { value: 'light', title: 'Light' },
          { value: 'dark', title: 'Dark' },
        ],
      },
    },
  },
  initialGlobals: {
    locale: 'en',
    theme: 'light',
  },
  parameters: {
    layout: 'padded',
    nextjs: {
      appDirectory: true,
      navigation: {
        pathname: '/',
        query: {},
      },
    },
    a11y: {
      test: 'error',
    },
  },
  decorators: [
    (Story, context) => {
      const locale = context.globals.locale === 'uk' ? 'uk' : 'en';
      const isDark = context.globals.theme === 'dark';

      return (
        <StoryEnvironment isDark={isDark} locale={locale}>
          <NextIntlClientProvider
            locale={locale}
            messages={messages[locale]}
            now={new Date('2026-09-09T12:00:00.000Z')}
            timeZone="Europe/Kyiv"
          >
            <div className={`${fontVariableClasses} min-h-svh bg-background p-4 text-foreground`}>
              <Story />
            </div>
          </NextIntlClientProvider>
        </StoryEnvironment>
      );
    },
  ],
};

export default preview;
