import type { Meta, StoryObj } from '@storybook/nextjs-vite';
import type { ColumnDef } from '@tanstack/react-table';
import {
  ArrowUpDownIcon,
  CalendarPlusIcon,
  LayoutGridIcon,
  ListIcon,
  MailIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PhoneIcon,
  PlusIcon,
  SendIcon,
  SlidersHorizontalIcon,
} from 'lucide-react';
import type { AuthMe } from '@tutorio/validation';
import { AppHeaderContent } from '@/components/app/app-header';
import { AppSidebarContent } from '@/components/app/app-sidebar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ContactRow } from '@/components/shared/contact-row';
import { CreditMeter } from '@/components/shared/credit-meter';
import { DataTable } from '@/components/shared/data-table';
import { EntityAvatar, type EntityAvatarStatus } from '@/components/shared/entity-avatar';
import { FilterPill } from '@/components/shared/filter-pill';
import { InfoCard } from '@/components/shared/info-card';
import { LessonItem } from '@/components/shared/lesson-item';
import { NextLessonCard } from '@/components/shared/next-lesson-card';
import { PersonItem } from '@/components/shared/person-item';
import { ProfileHero } from '@/components/shared/profile-hero';
import { SectionDivider } from '@/components/shared/section-divider';
import { StatBlock, type StatBlockSegment } from '@/components/shared/stat-block';


/**
 * Page fixtures that mirror `reference/students-list.png` and
 * `reference/student-profile.png` value for value, so a screenshot can be laid
 * over the approved design. They use the reference's own names, numbers and
 * dates — the live screens render whatever the API returns.
 */
const meta = {
  title: 'Fidelity/Studio',
  parameters: { layout: 'fullscreen', fullBleed: true },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

const session = {
  user: {
    id: '83d4d4e3-5e9b-4fd0-b9cc-8d6e5f3d0e8e',
    name: 'Olena Kovalenko',
    email: 'olena@example.com',
  },
  workspace: {
    id: 'dc7b01d3-f7df-4cc6-8a6e-bb216d16e97c',
    name: 'Kyiv English Studio',
    plan: 'PRO',
    mode: 'SCHOOL',
    defaultCurrency: 'UAH',
    cancellationDeadlineHours: 24,
  },
  role: 'OWNER',
} satisfies AuthMe;

function StudioShell({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider
        style={
          {
            '--sidebar-width': '316px',
            '--header-height': '3rem',
          } as React.CSSProperties
        }
      >
        <AppSidebarContent
          pathname={pathname}
          session={session}
          isSolo={false}
          onLogout={() => undefined}
        />
        <SidebarInset className="gap-6 pt-5 pr-6 pb-4">
          <AppHeaderContent pathname={pathname} workspaceName={session.workspace.name} />
          <div className="flex flex-1 flex-col gap-6">{children}</div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}

// ---------------------------------------------------------------------------
// Students list
// ---------------------------------------------------------------------------

type FixtureRow = {
  id: string;
  name: string;
  subtitle: string;
  avatarKey: string | null;
  status: EntityAvatarStatus;
  format: string;
  formatTone: 'indigo' | 'info' | 'warning' | 'neutral';
  teacher: string;
  left: number;
  total: number;
  nextDate: string;
  nextTime: string;
  today?: boolean;
  balance: string;
  balanceTone: 'success' | 'warning' | 'danger' | 'neutral';
  highlighted?: boolean;
};

const ROWS: FixtureRow[] = [
  { id: '1', name: 'Anna Shevchenko', subtitle: '@anna_s · English B2', avatarKey: 'user-1', status: 'active', format: 'Individual', formatTone: 'indigo', teacher: 'Dmytro Tutor', left: 6, total: 8, nextDate: 'Thu, 11 Sep', nextTime: '17:00 · 60 min', balance: 'Paid', balanceTone: 'success' },
  { id: '2', name: 'Sofiia Melnyk', subtitle: '@sofi_m · English B1', avatarKey: 'user-2', status: 'active', format: 'Individual', formatTone: 'indigo', teacher: 'Iryna Bondar', left: 1, total: 8, nextDate: 'Today', nextTime: '15:30 · 45 min', today: true, balance: 'Due 2 400 ₴', balanceTone: 'danger', highlighted: true },
  { id: '3', name: 'Maksym Tkachenko', subtitle: 'maksym.t@example.test', avatarKey: 'user-3', status: 'active', format: 'B1 English', formatTone: 'info', teacher: 'Dmytro Tutor', left: 6, total: 10, nextDate: 'Tue, 16 Sep', nextTime: '18:00 · 90 min', balance: 'Paid', balanceTone: 'success' },
  { id: '4', name: 'Daryna Kravets', subtitle: '+380 50 771 03 12', avatarKey: 'user-4', status: 'active', format: 'Individual', formatTone: 'indigo', teacher: 'Iryna Bondar', left: 4, total: 8, nextDate: 'Fri, 12 Sep', nextTime: '10:00 · 60 min', balance: 'Partly paid', balanceTone: 'warning' },
  { id: '5', name: 'Artem Lysenko', subtitle: '@artem_lys · IELTS', avatarKey: 'user-5', status: 'active', format: 'IELTS prep', formatTone: 'warning', teacher: 'Dmytro Tutor', left: 0, total: 8, nextDate: 'Mon, 15 Sep', nextTime: '19:00 · 60 min', balance: 'Due 4 000 ₴', balanceTone: 'danger' },
  { id: '6', name: 'Viktoriia Hnatiuk', subtitle: 'vika.h@example.test', avatarKey: 'user-6', status: 'active', format: 'B1 English', formatTone: 'info', teacher: 'Iryna Bondar', left: 8, total: 10, nextDate: 'Tue, 16 Sep', nextTime: '18:00 · 90 min', balance: 'Paid', balanceTone: 'success' },
  { id: '7', name: 'Oleksii Koval', subtitle: '+380 67 204 18 55', avatarKey: null, status: 'hold', format: 'B1 English', formatTone: 'info', teacher: 'Dmytro Tutor', left: 2, total: 8, nextDate: 'Paused', nextTime: 'back from 1 Oct', balance: 'Paid', balanceTone: 'success' },
  { id: '8', name: 'Kateryna Bondarenko', subtitle: 'Archived 1 Sep 2026', avatarKey: null, status: 'archived', format: 'No learning set up', formatTone: 'neutral', teacher: '—', left: 0, total: 0, nextDate: '—', nextTime: 'no lessons planned', balance: 'Settled', balanceTone: 'neutral' },
];

const ROW_LAYOUT =
  'minmax(0,2.3fr) minmax(0,1.5fr) minmax(0,1.25fr) minmax(0,1.25fr) minmax(0,1fr) 40px';

const COLUMNS: ColumnDef<FixtureRow, unknown>[] = [
  {
    id: 'student',
    header: () => 'Student',
    cell: ({ row }) => (
      <div className="flex min-w-0 items-center gap-3.5">
        <EntityAvatar
          avatarKey={row.original.avatarKey}
          fullName={row.original.name}
          status={row.original.status}
        />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-[15px] leading-5 font-semibold">{row.original.name}</span>
          <span className="truncate text-[13px] leading-[18px] text-muted-foreground">
            {row.original.subtitle}
          </span>
        </div>
      </div>
    ),
  },
  {
    id: 'learning',
    header: () => 'Learning',
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col items-start gap-1">
        <Badge variant={row.original.formatTone}>{row.original.format}</Badge>
        <span className="truncate text-xs text-muted-foreground">{row.original.teacher}</span>
      </div>
    ),
  },
  {
    id: 'credits',
    header: () => 'Credits',
    cell: ({ row }) =>
      row.original.total === 0 ? (
        <span className="text-[13px] text-muted-foreground">No active package</span>
      ) : (
        <CreditMeter
          left={row.original.left}
          total={row.original.total}
          label={
            row.original.left === 0
              ? 'No credits left'
              : `${row.original.left} of ${row.original.total} left`
          }
        />
      ),
  },
  {
    id: 'nextLesson',
    header: () => 'Next lesson',
    cell: ({ row }) => (
      <div className="flex min-w-0 flex-col items-start">
        {row.original.today ? (
          <Badge variant="brand" dot dotTone="current" className="mb-0.5">
            Today
          </Badge>
        ) : (
          <span className="text-sm leading-5 font-medium">{row.original.nextDate}</span>
        )}
        <span className="font-mono text-xs text-muted-foreground">{row.original.nextTime}</span>
      </div>
    ),
  },
  {
    id: 'balance',
    header: () => 'Balance',
    cell: ({ row }) => <Badge variant={row.original.balanceTone}>{row.original.balance}</Badge>,
  },
  {
    id: 'actions',
    header: () => <span className="sr-only">Actions</span>,
    cell: ({ row }) => (
      <div className="flex justify-end">
        <Button variant="ghost" size="icon-sm" aria-label={`Actions for ${row.original.name}`}>
          <MoreHorizontalIcon />
        </Button>
      </div>
    ),
  },
];

export const StudentsList: Story = {
  render: () => (
    <StudioShell pathname="/app/students">
      <div className="flex items-end justify-between gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-[64px] leading-none font-semibold tracking-[-0.04em]">
            Students
          </h1>
          <p className="text-base text-muted-foreground">
            48 people learning with you — 39 of them this week.
          </p>
        </div>
        <div className="flex gap-2.5">
          <Button size="xl" variant="outline">
            <CalendarPlusIcon data-icon="inline-start" />
            Schedule lesson
          </Button>
          <Button size="xl" leading={<PlusIcon />}>
            New student
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatBlock
          type="chart"
          chart="bars"
          tone="accent"
          label="Active students"
          value="39"
          data={[34, 37, 36, 39, 38, 41, 43, 42, 44, 46, 47, 48]}
          badge={{ label: '+4 this month', tone: 'success' }}
          caption="Of 48 students"
        />
        <StatBlock
          type="chart"
          chart="bars"
          label="Lessons this week"
          value="64"
          data={[36, 39, 38, 43, 41, 45, 44, 48]}
          badge={{ label: '8–14 Sep', tone: 'neutral' }}
          caption="52 individual · 12 group"
        />
        <StatBlock
          type="amount"
          label="Low on credits"
          value="5"
          unit="students"
          badge={{ label: '≤ 2 left', tone: 'warning' }}
          caption="10% of all"
          action={{ label: 'Offer top-up' }}
        />
        <StatBlock
          type="amount"
          tone="tint"
          label="Awaiting payment"
          value="12 400"
          unit="₴"
          badge={{ label: '4 packages', tone: 'warning' }}
          caption="Oldest is 9 days overdue"
        />
      </div>

      <div className="flex items-center justify-between gap-2.5">
        <div className="flex items-center gap-2.5">
          <ToggleGroup
            type="single"
            value="all"
            variant="segmented-solid"
            spacing={0.5}
            aria-label="Status"
          >
            <ToggleGroupItem value="all" className="gap-2 px-3.5 data-[state=on]:[&>span]:opacity-70">
              All
              <span className="font-mono text-xs">48</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="active" className="gap-2 px-3.5 data-[state=on]:[&>span]:opacity-70">
              Active
              <span className="font-mono text-xs">39</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="hold" className="gap-2 px-3.5 data-[state=on]:[&>span]:opacity-70">
              On hold
              <span className="font-mono text-xs">6</span>
            </ToggleGroupItem>
            <ToggleGroupItem value="archived" className="gap-2 px-3.5 data-[state=on]:[&>span]:opacity-70">
              Archived
              <span className="font-mono text-xs">3</span>
            </ToggleGroupItem>
          </ToggleGroup>
          <FilterPill label="Group" menu />
          <FilterPill label="Teacher" menu />
          <FilterPill label="Low credits" icon={<SlidersHorizontalIcon />} />
        </div>
        <div className="flex items-center gap-2.5">
          <FilterPill label="Next lesson" icon={<ArrowUpDownIcon />} />
          <ToggleGroup
            type="single"
            value="list"
            variant="segmented"
            size="icon"
            spacing={0.5}
            aria-label="View"
          >
            <ToggleGroupItem value="list" aria-label="List view">
              <ListIcon />
            </ToggleGroupItem>
            <ToggleGroupItem value="grid" aria-label="Card view">
              <LayoutGridIcon />
            </ToggleGroupItem>
          </ToggleGroup>
        </div>
      </div>

      <div className="flex flex-col rounded-card bg-card p-2">
        <DataTable
          variant="rows"
          layout={ROW_LAYOUT}
          columns={COLUMNS}
          data={ROWS}
          caption="Students"
          isRowHighlighted={(row) => row.highlighted === true}
        />
        <div className="mt-2 flex items-center justify-between border-t border-border px-4 pt-3 pb-2">
          <span className="text-[13px] text-muted-foreground">Showing 8 of 48 students</span>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5, 6].map((pageNumber) => (
              <Button
                key={pageNumber}
                variant={pageNumber === 1 ? 'primary' : 'ghost'}
                size="icon-sm"
                aria-label={`Page ${pageNumber}`}
                aria-current={pageNumber === 1 ? 'page' : undefined}
                className="font-mono text-[13px] font-normal"
              >
                {pageNumber}
              </Button>
            ))}
          </div>
        </div>
      </div>
    </StudioShell>
  ),
};

// ---------------------------------------------------------------------------
// Student profile
// ---------------------------------------------------------------------------

const ATTENDANCE: StatBlockSegment[] = [
  'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'ok', 'miss', 'ok', 'ok', 'ok', 'ok',
];

export const StudentProfile: Story = {
  render: () => (
    <StudioShell pathname="/app/students/anna">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <ProfileHero
          glyph="B2"
          avatar={
            <EntityAvatar avatarKey="user-1" fullName="Anna Shevchenko" size="2xl" ring="hero" />
          }
          badges={
            <>
              <Badge variant="surface" size="lg" dot dotTone="success">
                Active
              </Badge>
              <Badge variant="on-tint" size="lg">
                Student since Aug 2026
              </Badge>
            </>
          }
          name="Anna Shevchenko"
          meta={['English · B2 Upper-intermediate', 'Grade 10 · 15 y.o.', 'Kyiv, GMT+3']}
          contacts={
            <>
              <Button variant="white" size="icon" aria-label="Call +380 50 111 22 33">
                <PhoneIcon />
              </Button>
              <Button variant="white" size="icon" aria-label="Message @anna_s on Telegram">
                <SendIcon />
              </Button>
              <Button variant="white" size="icon" aria-label="Email anna@example.test">
                <MailIcon />
              </Button>
            </>
          }
          actions={
            <>
              <Button leading={<PlusIcon />}>Schedule lesson</Button>
              <Button variant="white">
                <PencilIcon data-icon="inline-start" />
                Edit profile
              </Button>
            </>
          }
        />
        <NextLessonCard
          heading="Next lesson"
          relative="in 2 days"
          date="Thu, 11 Sep"
          time="17:00 – 18:00 · Speaking"
          teacher={
            <PersonItem
              tone="ink"
              size="sm"
              media={<EntityAvatar avatarKey="user-2" fullName="Dmytro Tutor" size="sm" />}
              name="Dmytro Tutor"
              subtitle="Room 2 · uses 1 credit"
            />
          }
          primaryAction={<Button variant="soft">Open lesson</Button>}
          secondaryAction={<Button variant="dark-outline">Reschedule</Button>}
        />
      </div>

      <div className="grid grid-cols-4 gap-4">
        <StatBlock
          type="chart"
          chart="ring"
          label="Credits left"
          value="6 of 8"
          percent={75}
          caption="B2 preparation package"
          detail="2 used"
        />
        <StatBlock
          type="amount"
          label="Paid this term"
          value="4 000"
          unit="₴"
          badge={{ label: 'Nothing due', tone: 'success' }}
          caption="1 Sep · Package"
          detail="+4 000 ₴"
        />
        <StatBlock
          type="chart"
          chart="segments"
          label="Attendance"
          value="92%"
          data={ATTENDANCE}
          caption="11 attended · 1 late cancel"
        />
        <StatBlock
          type="date"
          label="B2 exam"
          value="Sat, 12 Dec"
          sub="in 81 days"
          badge={{ label: 'On track', tone: 'success' }}
          caption="Current level B1+"
          detail="→ B2"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2.1fr)_minmax(0,1fr)]">
        <Card className="gap-4 p-5">
          <Tabs defaultValue="lessons">
          <div className="flex items-center justify-between gap-3">
            <TabsList variant="segmented-subtle" aria-label="Sections">
              <TabsTrigger value="lessons">Lessons</TabsTrigger>
              <TabsTrigger value="packages">Packages</TabsTrigger>
              <TabsTrigger value="payments">Payments</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
            <Button variant="outline" size="sm">
              <PlusIcon data-icon="inline-start" />
              Add lesson
            </Button>
          </div>
          <TabsContent value="packages" />
          <TabsContent value="payments" />
          <TabsContent value="history" />
          <TabsContent value="lessons" className="flex flex-col pt-2">
            <SectionDivider label="Coming up · Tue & Thu at 17:00" className="pb-1" />
            <LessonItem
              state="next"
              date={{ top: 'Thu', day: '11' }}
              title="Speaking practice"
              meta="Sep · 17:00 – 18:00 · Dmytro Tutor"
              status={<Badge variant="brand">Next</Badge>}
              actions={
                <Button variant="ghost" size="icon-sm" aria-label="Lesson actions">
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <LessonItem
              date={{ top: 'Tue', day: '16' }}
              title="Grammar: past perfect"
              meta="Sep · 17:00 – 18:00 · Dmytro Tutor"
              status={<Badge variant="info">Scheduled</Badge>}
              actions={
                <Button variant="ghost" size="icon-sm" aria-label="Lesson actions">
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <LessonItem
              date={{ top: 'Thu', day: '18' }}
              title="Mock exam · Reading & writing"
              meta="Sep · 17:00 – 18:30 · Dmytro Tutor"
              status={<Badge variant="info">Scheduled</Badge>}
              actions={
                <Button variant="ghost" size="icon-sm" aria-label="Lesson actions">
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <SectionDivider label="Earlier" className="pt-2 pb-1" />
            <LessonItem
              state="past"
              date={{ top: 'Tue', day: '09' }}
              title="Listening"
              meta="Sep · 17:00 – 18:00 · attended · 1 credit used"
              status={<Badge variant="success">Completed</Badge>}
              actions={
                <Button variant="ghost" size="icon-sm" aria-label="Lesson actions">
                  <MoreHorizontalIcon />
                </Button>
              }
            />
            <LessonItem
              state="past"
              date={{ top: 'Thu', day: '04' }}
              title="Vocabulary"
              meta="Sep · Cancelled 3 h before start · charged"
              status={<Badge variant="danger">Late cancel</Badge>}
              actions={
                <Button variant="ghost" size="icon-sm" aria-label="Lesson actions">
                  <MoreHorizontalIcon />
                </Button>
              }
            />
          </TabsContent>
          </Tabs>
        </Card>

        <div className="flex flex-col gap-4">
          <Card tone="info" className="gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[13px] font-semibold tracking-[0.06em] text-tint-info-foreground uppercase">
                Package
              </span>
              <Badge variant="success" dot>
                Paid
              </Badge>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-display text-[26px] leading-8 font-semibold tracking-[-0.02em]">
                B2 preparation
              </span>
              <span className="text-[13px] text-tint-info-foreground">
                8 lessons · 500 ₴ each · bought 1 Sep
              </span>
            </div>
            <CreditMeter size="lg" left={6} total={8} usedLabel="2 used" leftLabel="6 left" />
          </Card>

          <InfoCard
            title="Family"
            action={
              <Button variant="link" size="xs" className="px-0">
                + Link parent
              </Button>
            }
          >
            <PersonItem
              media={<EntityAvatar fullName="Iryna Shevchenko" tint="warning" />}
              name="Iryna Shevchenko"
              subtitle="Mother · pays for lessons"
              action={
                <Button variant="white" size="icon-md" aria-label="Call Iryna Shevchenko">
                  <PhoneIcon />
                </Button>
              }
            />
          </InfoCard>

          <InfoCard title="Contacts">
            <ContactRow icon={PhoneIcon} mono>
              +380 50 111 22 33
            </ContactRow>
            <ContactRow icon={SendIcon}>@anna_s</ContactRow>
            <ContactRow icon={MailIcon}>anna@example.test</ContactRow>
          </InfoCard>

          <Card tone="warning" className="gap-3 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-semibold">Notes</h2>
              <Button variant="ghost" size="icon-sm" aria-label="Edit notes">
                <PencilIcon />
              </Button>
            </div>
            <p className="text-sm">
              Preparing for the B2 exam. Strong reading; practise speaking fluency and past tenses.
              Prefers homework by Telegram.
            </p>
            <span className="text-[13px] text-tint-warning-foreground">Updated 9 Sep by Dmytro</span>
          </Card>
        </div>
      </div>
    </StudioShell>
  ),
};

// ---------------------------------------------------------------------------
// Stat block sheet
// ---------------------------------------------------------------------------

const WEEKLY_LESSONS = [34, 37, 36, 39, 38, 41, 43, 42, 44, 46, 47, 48];

const SKILLS = [
  { label: 'Reading', value: 'B2', percent: 82 },
  { label: 'Listening', value: 'B2−', percent: 70 },
  { label: 'Writing', value: 'B1+', percent: 58 },
  { label: 'Speaking', value: 'B1+', percent: 52 },
];

/** Mirrors `reference/stat-block.png`, including its 1232px canvas. */
export const StatBlocks: Story = {
  render: () => (
    <div className="flex w-[1232px] flex-col gap-5 bg-background p-8">
      <div className="flex flex-col gap-1">
        <h1 className="text-[28px] leading-[34px] font-semibold tracking-[-0.02em]">Stat block</h1>
        <p className="text-sm text-muted-foreground">
          One block, four data types: amount, date, chart (bars · ring · segments) and custom rows.
          Same header, value zone and footer everywhere.
        </p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        <StatBlock
          type="amount"
          label="Paid this term"
          value="4 000"
          unit="₴"
          badge={{ label: 'Nothing due', tone: 'success' }}
          caption="Last payment 1 Sep"
          detail="+4 000 ₴"
        />
        <StatBlock
          type="amount"
          tone="ink"
          label="Awaiting payment"
          value="12 400"
          unit="₴"
          badge={{ label: '4 packages', tone: 'warning' }}
          caption="Oldest is 9 days overdue"
        />
        <StatBlock
          type="date"
          label="Next lesson"
          value="Thu, 11 Sep"
          sub="17:00 – 18:00"
          badge={{ label: 'in 2 days', tone: 'info' }}
          caption="Speaking · Dmytro Tutor"
        />
        <StatBlock
          type="date"
          tone="tint"
          label="Package expires"
          value="30 Nov"
          sub="2026"
          caption="B2 preparation"
          detail="69 days"
        />
        <StatBlock
          type="chart"
          chart="bars"
          tone="accent"
          label="Lessons this week"
          value="64"
          data={WEEKLY_LESSONS}
          badge={{ label: '+8%', tone: 'neutral' }}
          caption="52 individual · 12 group"
        />
        <StatBlock
          type="chart"
          chart="ring"
          label="Credits left"
          value="6 of 8"
          percent={75}
          caption="B2 preparation package"
          detail="2 used"
        />
        <StatBlock
          type="chart"
          chart="segments"
          label="Attendance"
          value="92%"
          data={ATTENDANCE}
          caption="11 attended · 1 late cancel"
        />
        <StatBlock
          type="custom"
          label="Towards B2 exam"
          items={SKILLS}
          badge={{ label: 'Dec 2026', tone: 'neutral' }}
          caption="Teacher assessment"
          detail="9 Sep"
        />
      </div>
    </div>
  ),
};
