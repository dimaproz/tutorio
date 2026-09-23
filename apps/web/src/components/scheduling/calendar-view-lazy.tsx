'use client';

import dynamic from 'next/dynamic';
import { LoadingPanel } from '@/components/shared/loading';

/**
 * The calendar screen, loaded on demand. react-big-calendar, its
 * drag-and-drop addon and their stylesheets live in this chunk only, so the
 * scheduling barrel no longer drags them into every screen that imports a
 * lesson dialog from it. The calendar reads its data on the client anyway,
 * so it is not rendered on the server.
 */
export const CalendarView = dynamic(
  () => import('./calendar-view').then((module) => module.CalendarView),
  { ssr: false, loading: () => <LoadingPanel size="lg" /> },
);
