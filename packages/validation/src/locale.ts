import { z } from 'zod';

// Supported UI locales. Ukrainian is the product default.
export const LOCALES = ['uk', 'en'] as const;

export const DEFAULT_LOCALE = 'uk' as const;

export const localeSchema = z.enum(LOCALES);

export type Locale = z.infer<typeof localeSchema>;
