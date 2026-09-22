import { Geist, Geist_Mono } from 'next/font/google';

// Geist ships as a variable font, so every weight the design uses (400/500/600
// for body and UI, 700 for the decorative hero glyph) is already available
// without declaring a weight list. `--font-display` in globals.css aliases this
// same variable: the display role is Geist today and can be swapped in one
// place later without touching a single screen.
export const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin', 'cyrillic'],
});

export const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const fontVariableClasses = `${geistSans.variable} ${geistMono.variable}`;
