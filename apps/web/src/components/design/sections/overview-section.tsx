'use client';

import { useMemo } from 'react';
import type { ApexOptions } from 'apexcharts';
import {
  ArrowUpRightIcon,
  BanknoteIcon,
  CalendarClockIcon,
  MoreHorizontalIcon,
  SendIcon,
  SparklesIcon,
  TriangleAlertIcon,
  UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Chart } from '@/components/design/shell/chart';
import { useIsDark } from '@/components/design/shell/use-is-dark';
import { RegisterStrip } from '@/components/design/register-strip';
import { StatusBadge } from '@/components/design/status-badge';
import {
  formatMoney,
  LESSONS_PER_WEEK,
  STUDENTS,
} from '@/components/design/demo-data';
import type { LucideIcon } from 'lucide-react';

// The eCommerce-style dashboard from TailAdmin, refit to Tutorio's data: a row
// of metric tiles, a bar chart + radial target, and a recent-students table
// beside the day's follow-ups. Everything sits in boxed cards on the grey page.
export function OverviewSection() {
  return (
    <div className="flex flex-col gap-4 md:gap-6">
      <MetricRow />

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <LessonsChartCard />
        <TargetCard />
      </div>

      <div className="grid gap-4 md:gap-6 xl:grid-cols-3">
        <RecentStudentsCard />
        <AttentionCard />
      </div>
    </div>
  );
}

type Trend = { dir: 'up' | 'down'; text: string };

function TrendPill({ dir, text }: Trend) {
  const up = dir === 'up';
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        backgroundColor: up ? 'var(--settled-wash)' : 'var(--due-wash)',
        color: up ? 'var(--settled)' : 'var(--due)',
      }}
    >
      <ArrowUpRightIcon className={up ? 'size-3' : 'size-3 rotate-90'} aria-hidden="true" />
      {text}
    </span>
  );
}

function MetricCard({
  icon: Icon,
  label,
  value,
  trend,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  trend?: Trend;
}) {
  return (
    <Card className="gap-5 p-5">
      <span className="bg-muted text-foreground grid size-12 place-items-center rounded-xl">
        <Icon className="size-6" aria-hidden="true" />
      </span>
      <div className="flex items-end justify-between gap-2">
        <div className="flex flex-col gap-1">
          <span className="text-muted-foreground text-sm">{label}</span>
          <span className="numeral text-2xl font-semibold">{value}</span>
        </div>
        {trend ? <TrendPill {...trend} /> : null}
      </div>
    </Card>
  );
}

function MetricRow() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 md:gap-6 xl:grid-cols-4">
      <MetricCard
        icon={UsersIcon}
        label="Активні учні"
        value="12"
        trend={{ dir: 'up', text: '+2' }}
      />
      <MetricCard
        icon={CalendarClockIcon}
        label="Занять на тиждень"
        value="29"
        trend={{ dir: 'up', text: '16%' }}
      />
      <MetricCard
        icon={BanknoteIcon}
        label="Надійшло у липні"
        value={formatMoney(1202000, 'UAH')}
        trend={{ dir: 'up', text: '8%' }}
      />
      <MetricCard
        icon={TriangleAlertIcon}
        label="Прострочено"
        value={formatMoney(104000, 'UAH')}
        trend={{ dir: 'down', text: '9 дн' }}
      />
    </div>
  );
}

// Shared chart palette. Brand is stable across themes; axis grey reads on both;
// grid/track lighten or darken with the theme.
function useChartColors() {
  const isDark = useIsDark();
  return useMemo(
    () => ({
      isDark,
      brand: '#465fff',
      axis: '#98a2b3',
      grid: isDark ? 'rgba(255,255,255,0.08)' : '#f2f4f7',
      track: isDark ? 'rgba(255,255,255,0.06)' : '#f2f4f7',
      valueColor: isDark ? '#ffffff' : '#1d2939',
    }),
    [isDark],
  );
}

const WEEK_LABELS = ['−7', '−6', '−5', '−4', '−3', '−2', '−1', 'Зараз'];

function LessonsChartCard() {
  const c = useChartColors();

  const options: ApexOptions = useMemo(
    () => ({
      chart: {
        type: 'bar',
        fontFamily: 'inherit',
        background: 'transparent',
        toolbar: { show: false },
        animations: { enabled: false },
      },
      colors: [c.brand],
      plotOptions: {
        bar: { borderRadius: 5, columnWidth: '42%', borderRadiusApplication: 'end' },
      },
      dataLabels: { enabled: false },
      states: { hover: { filter: { type: 'none' } } },
      grid: {
        borderColor: c.grid,
        strokeDashArray: 4,
        xaxis: { lines: { show: false } },
        yaxis: { lines: { show: true } },
      },
      xaxis: {
        categories: WEEK_LABELS,
        axisBorder: { show: false },
        axisTicks: { show: false },
        labels: { style: { colors: c.axis, fontSize: '12px' } },
      },
      yaxis: { labels: { style: { colors: c.axis, fontSize: '12px' } } },
      legend: { show: false },
      tooltip: {
        theme: c.isDark ? 'dark' : 'light',
        y: { formatter: (value: number) => `${value} занять` },
      },
    }),
    [c],
  );

  const series = useMemo(() => [{ name: 'Заняття', data: LESSONS_PER_WEEK }], []);

  return (
    <Card className="gap-4 xl:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <div className="flex flex-col gap-1">
          <CardTitle className="text-base">Заняття на тиждень</CardTitle>
          <span className="text-muted-foreground text-sm">Останні 8 тижнів</span>
        </div>
        <Button variant="outline" size="icon" aria-label="Дії">
          <MoreHorizontalIcon />
        </Button>
      </CardHeader>
      <CardContent>
        <Chart type="bar" options={options} series={series} height={230} />
      </CardContent>
    </Card>
  );
}

function TargetCard() {
  const c = useChartColors();

  const options: ApexOptions = useMemo(
    () => ({
      chart: { type: 'radialBar', fontFamily: 'inherit', background: 'transparent' },
      colors: [c.brand],
      stroke: { lineCap: 'round' },
      plotOptions: {
        radialBar: {
          hollow: { size: '62%' },
          track: { background: c.track, strokeWidth: '100%' },
          dataLabels: {
            name: { show: true, offsetY: 24, color: c.axis, fontSize: '13px' },
            value: {
              show: true,
              offsetY: -14,
              fontSize: '30px',
              fontWeight: 600,
              color: c.valueColor,
              formatter: (value: number) => `${Math.round(value)}%`,
            },
          },
        },
      },
      labels: ['Проведено'],
    }),
    [c],
  );

  return (
    <Card className="gap-2">
      <CardHeader className="flex flex-col items-start gap-1">
        <CardTitle className="text-base">Використання абонементів</CardTitle>
        <span className="text-muted-foreground text-sm">Проведено від проданого</span>
      </CardHeader>
      <CardContent className="flex flex-col items-center">
        <Chart type="radialBar" options={options} series={[68]} height={260} />
        <p className="text-muted-foreground -mt-4 text-center text-sm">
          68% занять уже проведено. Час пропонувати наступні абонементи.
        </p>
      </CardContent>
    </Card>
  );
}

function RecentStudentsCard() {
  return (
    <Card className="gap-4 xl:col-span-2">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Останні учні</CardTitle>
        <Button variant="link" size="sm" className="text-primary">
          Усі учні
        </Button>
      </CardHeader>
      <CardContent className="px-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="pl-6">Учень</TableHead>
              <TableHead>Група</TableHead>
              <TableHead>Абонемент</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="pr-6 text-right">Ціна</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STUDENTS.slice(0, 5).map((student) => (
              <TableRow key={student.id}>
                <TableCell className="pl-6">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-9">
                      <AvatarFallback className="text-[11px]">{student.initials}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{student.name}</span>
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {student.group ?? 'Індивідуально'}
                </TableCell>
                <TableCell>
                  <RegisterStrip used={student.used} total={student.total} size="sm" showCount={false} />
                </TableCell>
                <TableCell>
                  <StatusBadge status={student.status} />
                </TableCell>
                <TableCell className="numeral pr-6 text-right whitespace-nowrap">
                  {formatMoney(student.priceMinor, student.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function AttentionCard() {
  return (
    <Card className="gap-4">
      <CardHeader>
        <CardTitle className="text-base">Потребує уваги</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <article className="flex flex-col gap-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <Avatar className="size-8">
                <AvatarFallback className="text-[11px]">МК</AvatarFallback>
              </Avatar>
              <span className="truncate text-sm font-medium">Марʼяна Ковальчук</span>
            </div>
            <StatusBadge status="overdue" />
          </div>
          <RegisterStrip used={8} total={8} size="sm" />
          <p className="text-muted-foreground text-xs">
            Заняття вичерпані, {formatMoney(104000, 'UAH')} не сплачено 9 днів.
          </p>
          <Button
            size="sm"
            variant="outline"
            className="w-fit"
            onClick={() => toast.success('Нагадування надіслано')}
          >
            <SendIcon data-icon="inline-start" />
            Нагадати про оплату
          </Button>
        </article>

        <div className="bg-muted/60 flex flex-col gap-2 rounded-xl p-3">
          <div className="flex items-center gap-1.5">
            <SparklesIcon className="text-primary size-3.5" aria-hidden="true" />
            <span className="register-label">Чернетка нагадування</span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            «Доброго дня, Марʼяно! Нагадую про оплату абонемента на 8 занять — 1 040 ₴. Дякую!»
          </p>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline">
              Надіслати
            </Button>
            <Button size="sm" variant="ghost">
              Змінити
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
