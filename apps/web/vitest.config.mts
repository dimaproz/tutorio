/// <reference types="@vitest/browser/providers/playwright" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { defineConfig } from 'vitest/config';

const directory = path.dirname(fileURLToPath(import.meta.url));
const hasWindowsUnicodePath = process.platform === 'win32' && /[^\u0000-\u007f]/.test(directory);

const windowsUnicodePathWorkaround = hasWindowsUnicodePath
  ? {
      name: 'storybook-windows-unicode-path-workaround',
      transform: {
        order: 'post' as const,
        handler(code: string, id: string) {
          if (!id.includes('.stories.') || !code.includes('const _isRunningFromThisFile =')) {
            return;
          }

          // Storybook's Vitest transform compares differently encoded Windows paths.
          // This project runs only story files in this project, so every transformed file is a test entry.
          return code.replace(
            /const _isRunningFromThisFile = convertToFilePath\(import\.meta\.url\)\.includes\([^;]+;/,
            'const _isRunningFromThisFile = true;',
          );
        },
      },
    }
  : undefined;

export default defineConfig({
  test: {
    projects: [
      {
        resolve: {
          alias: {
            '@': path.resolve(directory, 'src'),
          },
        },
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
          // Not the studio's zone: every date must be read on the studio's
          // clock (`lib/datetime`), so a model that leans on the process zone fails.
          env: { TZ: 'America/New_York' },
        },
      },
      {
        plugins: [
          storybookTest({
            configDir: path.join(directory, '.storybook'),
          }),
          windowsUnicodePathWorkaround,
        ],
        resolve: {
          alias: {
            '@': path.resolve(directory, 'src'),
          },
        },
        test: {
          name: 'storybook',
          setupFiles: [path.join(directory, '.storybook/vitest.setup.ts')],
          browser: {
            enabled: true,
            provider: 'playwright',
            headless: true,
            // A browser far from the studio: the stories' dates must still read
            // Kyiv's clock (the preview's next-intl zone), not the browser's.
            instances: [{ browser: 'chromium', context: { timezoneId: 'America/New_York' } }],
          },
        },
      },
    ],
  },
});
