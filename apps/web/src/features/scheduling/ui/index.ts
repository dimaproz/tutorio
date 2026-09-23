// The lazy entry: importing this barrel must not load react-big-calendar.
export { CalendarView } from '@/components/scheduling/calendar-view-lazy';
export { SeriesManager } from '@/components/scheduling/series-manager';
export { LessonMobileItem, LessonMobileList } from '@/components/scheduling/lesson-mobile-list';
export { LessonFormDialog } from '@/components/scheduling/lesson-form-dialog';
export {
  LessonActionsDialog,
  type LessonDialogMode,
} from '@/components/scheduling/lesson-actions-dialog';
export {
  StudentLessonsCard,
  studentLessonsRange,
} from '@/components/scheduling/student-lessons-card';
