import type { StatusKey } from './status-badge';

// Realistic Ukrainian fixtures. Money is kept in minor units, as in the real
// product, and formatted through Intl at the point of display.

export const TODAY = new Date('2026-07-20T09:00:00+03:00');

export function formatMoney(amountMinor: number, currency: string): string {
  return new Intl.NumberFormat('uk-UA', {
    style: 'currency',
    currency,
    minimumFractionDigits: amountMinor % 100 === 0 ? 0 : 2,
  }).format(amountMinor / 100);
}

export function formatDate(date: Date, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('uk-UA', { timeZone: 'Europe/Kyiv', ...options }).format(date);
}

/**
 * Ukrainian Intl returns weekday and month names in lower case, which is
 * correct mid-sentence but wrong for a heading. Capitalising the first letter
 * only — never `text-transform: capitalize`, which would also touch the month.
 */
export function formatDateTitle(date: Date, options: Intl.DateTimeFormatOptions): string {
  const value = formatDate(date, options);
  return value.charAt(0).toLocaleUpperCase('uk-UA') + value.slice(1);
}

/**
 * Initials for an avatar fallback, from a display name. Takes the first letter
 * of the first two words ("Богдан Мельник" → "БМ"), so tables and mentions that
 * only carry a name string can still show a consistent avatar.
 */
export function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toLocaleUpperCase('uk-UA'))
    .join('');
}

export interface DemoLesson {
  id: string;
  time: string;
  student: string;
  initials: string;
  kind: 'individual' | 'group';
  groupName?: string;
  durationMin: number;
  state: 'past' | 'now' | 'upcoming';
}

export const TODAY_LESSONS: DemoLesson[] = [
  {
    id: 'l1',
    time: '09:30',
    student: 'Марʼяна Ковальчук',
    initials: 'МК',
    kind: 'individual',
    durationMin: 60,
    state: 'past',
  },
  {
    id: 'l2',
    time: '11:00',
    student: 'Група B1 «Вечірня»',
    initials: 'B1',
    kind: 'group',
    groupName: 'B1 «Вечірня»',
    durationMin: 90,
    state: 'now',
  },
  {
    id: 'l3',
    time: '14:00',
    student: 'Богдан Мельник',
    initials: 'БМ',
    kind: 'individual',
    durationMin: 60,
    state: 'upcoming',
  },
  {
    id: 'l4',
    time: '18:30',
    student: 'Аліса Демченко',
    initials: 'АД',
    kind: 'individual',
    durationMin: 45,
    state: 'upcoming',
  },
];

export interface DemoStudent {
  id: string;
  name: string;
  initials: string;
  contact: string;
  group: string | null;
  teacher: string;
  used: number;
  total: number;
  priceMinor: number;
  currency: string;
  status: StatusKey;
  debtMinor?: number;
  overdueDays?: number;
}

export const STUDENTS: DemoStudent[] = [
  {
    id: 's1',
    name: 'Аліса Демченко',
    initials: 'АД',
    contact: 'alisa.demchenko@gmail.com',
    group: 'B1 «Вечірня»',
    teacher: 'Олена Гриценко',
    used: 2,
    total: 10,
    priceMinor: 45000,
    currency: 'UAH',
    status: 'active',
  },
  {
    id: 's2',
    name: 'Богдан Мельник',
    initials: 'БМ',
    contact: '+380 67 214 88 03',
    group: 'B1 «Вечірня»',
    teacher: 'Тарас Ліщук',
    used: 6,
    total: 8,
    priceMinor: 42000,
    currency: 'UAH',
    status: 'active',
  },
  {
    id: 's3',
    name: 'Марʼяна Ковальчук',
    initials: 'МК',
    contact: 'mariana.k@ukr.net',
    group: null,
    teacher: 'Олена Гриценко',
    used: 8,
    total: 8,
    priceMinor: 52000,
    currency: 'UAH',
    status: 'overdue',
    debtMinor: 104000,
    overdueDays: 9,
  },
  {
    id: 's4',
    name: 'Софія Тарасенко',
    initials: 'СТ',
    contact: 'sofia.tarasenko@gmail.com',
    group: 'A2 «Ранкова»',
    teacher: 'Тарас Ліщук',
    used: 3,
    total: 12,
    priceMinor: 38000,
    currency: 'UAH',
    status: 'paused',
  },
  {
    id: 's5',
    name: 'Ігор Бондаренко',
    initials: 'ІБ',
    contact: 'i.bondarenko@outlook.com',
    group: null,
    teacher: 'Олена Гриценко',
    used: 10,
    total: 10,
    priceMinor: 60000,
    currency: 'UAH',
    status: 'archived',
  },
];

export interface DemoPayment {
  id: string;
  date: Date;
  student: string;
  purpose: string;
  amountMinor: number;
  currency: string;
  method: 'Готівка' | 'Переказ' | 'Інше';
  status: StatusKey;
}

export const PAYMENTS: DemoPayment[] = [
  {
    id: 'p1',
    date: new Date('2026-07-18T12:00:00+03:00'),
    student: 'Аліса Демченко',
    purpose: 'Абонемент, 10 занять',
    amountMinor: 450000,
    currency: 'UAH',
    method: 'Переказ',
    status: 'paid',
  },
  {
    id: 'p2',
    date: new Date('2026-07-11T12:00:00+03:00'),
    student: 'Марʼяна Ковальчук',
    purpose: 'Абонемент, 8 занять',
    amountMinor: 416000,
    currency: 'UAH',
    method: 'Переказ',
    status: 'overdue',
  },
  {
    id: 'p3',
    date: new Date('2026-07-09T12:00:00+03:00'),
    student: 'Богдан Мельник',
    purpose: 'Абонемент, 8 занять',
    amountMinor: 336000,
    currency: 'UAH',
    method: 'Готівка',
    status: 'paid',
  },
  {
    id: 'p4',
    date: new Date('2026-07-02T12:00:00+03:00'),
    student: 'Софія Тарасенко',
    purpose: 'Абонемент, 12 занять',
    amountMinor: 456000,
    currency: 'UAH',
    method: 'Переказ',
    status: 'cancelled',
  },
];

/** Lessons held per week over the last eight weeks — the sparkline series. */
export const LESSONS_PER_WEEK = [18, 22, 19, 24, 23, 27, 25, 29];
