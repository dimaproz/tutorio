'use client';

import { useEffect, useState } from 'react';
import {
  AlertCircleIcon,
  BellIcon,
  CheckIcon,
  ClockIcon,
  CommandIcon,
  MoreHorizontalIcon,
  PhoneIcon,
  PlusIcon,
  ReceiptIcon,
  SearchIcon,
  SendIcon,
  UsersIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { LabBlock, LabSection, LabStage } from '@/components/design/lab-kit';
import { RegisterStrip } from '@/components/design/register-strip';
import { StatusBadge } from '@/components/design/status-badge';
import {
  formatDate,
  formatMoney,
  getInitials,
  PAYMENTS,
  STUDENTS,
  TODAY_LESSONS,
  type DemoStudent,
} from '@/components/design/demo-data';
import { cn } from '@/lib/utils';

export function PatternsSection() {
  return (
    <div className="flex flex-col gap-10">
      <StudentListStates />
      <StudentProfile />
      <PackageStates />
      <StudentFormPattern />
      <SchedulingPattern />
      <SellPackagePattern />
      <PaymentsTable />
      <CommandPalettePattern />
      <NotificationsPattern />
      <OnboardingPattern />
      <ResponsivePattern />
    </div>
  );
}

function StudentRow({ student, compact = false }: { student: DemoStudent; compact?: boolean }) {
  return (
    <div className={cn('flex items-center gap-3', compact ? 'py-2' : 'py-3')}>
      <Avatar className={compact ? 'size-7' : 'size-9'}>
        <AvatarFallback className="text-[11px]">{student.initials}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium">{student.name}</span>
          {!compact ? <StatusBadge status={student.status} /> : null}
        </div>
        {!compact ? (
          <span className="text-muted-foreground truncate text-xs">
            {student.group ?? 'Індивідуально'} · {student.teacher}
          </span>
        ) : null}
      </div>
      <div className="hidden w-40 shrink-0 sm:block">
        <RegisterStrip used={student.used} total={student.total} size="sm" showCount={!compact} />
      </div>
      <Button size="icon" variant="ghost" className="shrink-0" aria-label={`Дії — ${student.name}`}>
        <MoreHorizontalIcon />
      </Button>
    </div>
  );
}

function StudentListStates() {
  return (
    <LabSection
      title="Список учнів"
      description="Один патерн у пʼяти станах. Клітинки абонемента показані прямо в рядку — саме через них видно, кому скоро продавати."
      className="border-t-0 pt-0"
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <LabBlock label="Звичайний">
          <LabStage padded={false}>
            <div className="divide-border divide-y px-4">
              {STUDENTS.slice(0, 3).map((student) => (
                <StudentRow key={student.id} student={student} />
              ))}
            </div>
          </LabStage>
        </LabBlock>

        <LabBlock label="Щільний" hint="для великих списків">
          <LabStage padded={false}>
            <div className="divide-border divide-y px-4">
              {STUDENTS.map((student) => (
                <StudentRow key={student.id} student={student} compact />
              ))}
            </div>
          </LabStage>
        </LabBlock>

        <LabBlock label="Завантаження">
          <LabStage>
            <div className="flex flex-col gap-4">
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <Skeleton className="size-9 rounded-full" />
                  <div className="flex flex-1 flex-col gap-1.5">
                    <Skeleton className="h-4 w-36" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <Skeleton className="h-3 w-28" />
                </div>
              ))}
            </div>
          </LabStage>
        </LabBlock>

        <LabBlock label="Порожньо після пошуку">
          <LabStage>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <SearchIcon />
                </EmptyMedia>
                <EmptyTitle>Нікого не знайдено</EmptyTitle>
                <EmptyDescription>
                  За запитом «ковальч» немає збігів. Спробуйте частину імені або телефон.
                </EmptyDescription>
              </EmptyHeader>
              <Button size="sm" variant="outline">
                Очистити пошук
              </Button>
            </Empty>
          </LabStage>
        </LabBlock>

        <LabBlock label="Помилка" className="lg:col-span-2">
          <LabStage>
            <Alert variant="destructive">
              <AlertCircleIcon />
              <AlertTitle>Не вдалося завантажити список</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>Сервер не відповів. Дані на місці — потрібно лише повторити запит.</span>
                <Button size="xs" variant="outline">
                  Спробувати ще раз
                </Button>
              </AlertDescription>
            </Alert>
          </LabStage>
        </LabBlock>
      </div>
    </LabSection>
  );
}

function StudentProfile() {
  return (
    <LabSection
      title="Картка учня"
      description="Порожні поля не показуються взагалі — замість прочерків просто менше блоків."
    >
      <LabStage>
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                <AvatarFallback>МК</AvatarFallback>
              </Avatar>
              <div className="flex flex-col gap-1">
                <h3 className="workbook text-xl font-semibold">Марʼяна Ковальчук</h3>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status="overdue" />
                  <span className="text-muted-foreground text-xs">Europe/Kyiv · Індивідуально</span>
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline">
                Редагувати
              </Button>
              <Button size="sm">
                <ReceiptIcon data-icon="inline-start" />
                Продати абонемент
              </Button>
            </div>
          </div>

          <Alert>
            <AlertCircleIcon />
            <AlertTitle>Заборгованість {formatMoney(104000, 'UAH')}</AlertTitle>
            <AlertDescription className="flex flex-col items-start gap-2">
              <span>Абонемент вичерпано, оплата не надійшла 9 днів.</span>
              <div className="flex gap-2">
                <Button size="xs" onClick={() => toast.success('Нагадування надіслано')}>
                  <SendIcon data-icon="inline-start" />
                  Нагадати
                </Button>
                <Button size="xs" variant="outline">
                  Записати платіж
                </Button>
              </div>
            </AlertDescription>
          </Alert>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <span className="register-label">Контакти</span>
              <a className="text-sm underline underline-offset-4" href="mailto:mariana.k@ukr.net">
                mariana.k@ukr.net
              </a>
              <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                <PhoneIcon className="size-3.5" aria-hidden="true" />
                +380 63 447 12 90
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <span className="register-label">Абонемент</span>
              <RegisterStrip used={8} total={8} />
              <span className="text-muted-foreground text-xs">
                Куплено 11 липня · {formatMoney(416000, 'UAH')}
              </span>
            </div>
          </div>
        </div>
      </LabStage>
    </LabSection>
  );
}

function PackageStates() {
  const states = [
    { label: 'Активний', used: 3, total: 10, status: 'active' as const, note: 'Усе спокійно' },
    { label: 'Закінчується', used: 8, total: 10, status: 'active' as const, note: 'Час пропонувати наступний' },
    { label: 'Вичерпаний', used: 8, total: 8, status: 'paused' as const, note: 'Заняття зупинені' },
    { label: 'Прострочена оплата', used: 8, total: 8, status: 'overdue' as const, note: '9 днів без оплати' },
  ];

  return (
    <LabSection
      title="Абонемент"
      description="Чотири стани одного обʼєкта. У кожному видно, що робити далі."
    >
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {states.map((state) => (
          <Card key={state.label}>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-2 text-sm">
                {state.label}
                <StatusBadge status={state.status} />
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-3">
              <RegisterStrip used={state.used} total={state.total} size="sm" />
              <span className="text-muted-foreground text-xs">{state.note}</span>
              <Button
                size="xs"
                variant={state.status === 'active' && state.used < 8 ? 'ghost' : 'outline'}
                className="w-fit"
              >
                {state.status === 'overdue' ? 'Нагадати' : 'Продати наступний'}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </LabSection>
  );
}

function StudentFormPattern() {
  return (
    <LabSection
      title="Створення учня"
      description="Обовʼязкове — тільки імʼя й часовий пояс. Решта заповнюється потім, коли зʼявиться привід."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <LabBlock label="Заповнення">
          <LabStage>
            <div className="flex flex-col gap-4">
              <Field>
                <FieldLabel htmlFor="p-name">Імʼя та прізвище</FieldLabel>
                <Input id="p-name" defaultValue="Софія Тарасенко" />
              </Field>
              <Field>
                <FieldLabel htmlFor="p-tz">Часовий пояс</FieldLabel>
                <Select defaultValue="kyiv">
                  <SelectTrigger id="p-tz" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      <SelectItem value="kyiv">Europe/Kyiv</SelectItem>
                      <SelectItem value="warsaw">Europe/Warsaw</SelectItem>
                      <SelectItem value="london">Europe/London</SelectItem>
                    </SelectGroup>
                  </SelectContent>
                </Select>
                <FieldDescription>Час занять учень бачитиме у своєму поясі.</FieldDescription>
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost">Скасувати</Button>
                <Button onClick={() => toast.success('Учня створено')}>Створити</Button>
              </div>
            </div>
          </LabStage>
        </LabBlock>

        <LabBlock label="Помилка валідації" hint="поруч із полем, з підказкою як виправити">
          <LabStage>
            <div className="flex flex-col gap-4">
              <Field data-invalid>
                <FieldLabel htmlFor="p-name-err">Імʼя та прізвище</FieldLabel>
                <Input id="p-name-err" defaultValue="" aria-invalid />
                <FieldError errors={[{ message: 'Введіть імʼя — за ним учень шукається у списку.' }]} />
              </Field>
              <Field data-invalid>
                <FieldLabel htmlFor="p-phone-err">Телефон</FieldLabel>
                <Input id="p-phone-err" defaultValue="+380 6" aria-invalid />
                <FieldError errors={[{ message: 'Замало цифр. Формат: +380 XX XXX XX XX.' }]} />
              </Field>
              <div className="flex justify-end gap-2">
                <Button variant="ghost">Скасувати</Button>
                <Button disabled>Створити</Button>
              </div>
            </div>
          </LabStage>
        </LabBlock>
      </div>
    </LabSection>
  );
}

function SchedulingPattern() {
  return (
    <LabSection
      title="Перенесення заняття"
      description="Перенесення зачіпає гроші, тому наслідок написаний до підтвердження, а не після."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <LabBlock label="Вибір нового часу">
          <LabStage>
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-3">
                <span className="numeral text-muted-foreground text-sm">14:00</span>
                <Avatar className="size-8">
                  <AvatarFallback className="text-[11px]">{getInitials('Богдан Мельник')}</AvatarFallback>
                </Avatar>
                <span className="text-sm">Богдан Мельник · сьогодні</span>
              </div>
              <Separator />
              <RadioGroup defaultValue="thu" className="gap-2.5">
                {[
                  { value: 'wed', label: 'Середа, 22 липня · 14:00', hint: 'вільно' },
                  { value: 'thu', label: 'Четвер, 23 липня · 14:00', hint: 'вільно' },
                  { value: 'fri', label: 'Пʼятниця, 24 липня · 14:00', hint: 'зайнято — Аліса' },
                ].map((slot) => (
                  <div key={slot.value} className="flex items-center gap-2">
                    <RadioGroupItem
                      value={slot.value}
                      id={`slot-${slot.value}`}
                      disabled={slot.hint.startsWith('зайнято')}
                    />
                    <Label htmlFor={`slot-${slot.value}`} className="flex-1 font-normal">
                      {slot.label}
                    </Label>
                    <span
                      className={cn(
                        'text-xs',
                        slot.hint.startsWith('зайнято')
                          ? 'text-[var(--due)]'
                          : 'text-muted-foreground',
                      )}
                    >
                      {slot.hint}
                    </span>
                  </div>
                ))}
              </RadioGroup>
              <Button className="w-fit" onClick={() => toast.success('Заняття перенесено')}>
                Перенести
              </Button>
            </div>
          </LabStage>
        </LabBlock>

        <LabBlock label="Пізнє скасування" hint="межовий випадок: заняття списується">
          <LabStage>
            <Alert>
              <ClockIcon />
              <AlertTitle>До заняття менше ніж 24 години</AlertTitle>
              <AlertDescription className="flex flex-col items-start gap-2">
                <span>
                  За правилами простору заняття спишеться з абонемента. Залишиться 1 з 8.
                </span>
                <div className="flex gap-2">
                  <Button size="xs" variant="outline">
                    Усе одно скасувати
                  </Button>
                  <Button size="xs" variant="ghost">
                    Не скасовувати
                  </Button>
                </div>
              </AlertDescription>
            </Alert>
          </LabStage>
        </LabBlock>
      </div>
    </LabSection>
  );
}

function SellPackagePattern() {
  return (
    <LabSection
      title="Продаж абонемента"
      description="Підсумок рахується на очах, щоб не було сюрпризу після натискання."
    >
      <LabStage className="max-w-xl">
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="sell-count">Кількість занять</FieldLabel>
            <Select defaultValue="10">
              <SelectTrigger id="sell-count" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="4">4 заняття</SelectItem>
                  <SelectItem value="8">8 занять</SelectItem>
                  <SelectItem value="10">10 занять</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="sell-price">Ціна заняття</FieldLabel>
            <Input id="sell-price" inputMode="decimal" defaultValue="450" />
            <FieldDescription>Ціна фіксується на момент продажу і далі не змінюється.</FieldDescription>
          </Field>

          <div className="bg-muted/50 border-border flex items-center justify-between rounded-lg border px-4 py-3">
            <span className="text-sm">До сплати</span>
            <span className="numeral text-xl">{formatMoney(450000, 'UAH')}</span>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox id="sell-paid" defaultChecked />
            <Label htmlFor="sell-paid" className="font-normal">
              Оплата вже отримана
            </Label>
          </div>

          <Button className="w-fit" onClick={() => toast.success('Абонемент продано')}>
            Продати абонемент
          </Button>
        </div>
      </LabStage>
    </LabSection>
  );
}

function PaymentsTable() {
  return (
    <LabSection
      title="Платежі"
      description="Валюти не сумуються — підсумок рахується окремо для кожної, як вимагає бухгалтерія продукту."
    >
      <div className="flex flex-wrap items-center gap-2">
        <Select defaultValue="july">
          <SelectTrigger className="w-44" aria-label="Період">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="july">Липень 2026</SelectItem>
              <SelectItem value="june">Червень 2026</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select defaultValue="all">
          <SelectTrigger className="w-40" aria-label="Статус">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectItem value="all">Усі статуси</SelectItem>
              <SelectItem value="paid">Оплачено</SelectItem>
              <SelectItem value="overdue">Прострочено</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
      </div>

      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата</TableHead>
              <TableHead>Учень</TableHead>
              <TableHead className="hidden sm:table-cell">Призначення</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Сума</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {PAYMENTS.map((payment) => (
              <TableRow key={payment.id}>
                <TableCell className="numeral text-muted-foreground whitespace-nowrap">
                  {formatDate(payment.date, { day: 'numeric', month: 'short' })}
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-[11px]">
                        {getInitials(payment.student)}
                      </AvatarFallback>
                    </Avatar>
                    {payment.student}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground hidden sm:table-cell">
                  {payment.purpose}
                </TableCell>
                <TableCell>
                  <StatusBadge status={payment.status} />
                </TableCell>
                <TableCell
                  className={cn(
                    'numeral text-right whitespace-nowrap',
                    payment.status === 'overdue' && 'text-[var(--due)]',
                    payment.status === 'cancelled' && 'text-muted-foreground line-through',
                  )}
                >
                  {formatMoney(payment.amountMinor, payment.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <div className="flex flex-wrap justify-end gap-6 text-sm">
        <span className="text-muted-foreground">
          Оплачено:{' '}
          <span className="numeral text-[var(--settled)]">{formatMoney(786000, 'UAH')}</span>
        </span>
        <span className="text-muted-foreground">
          Прострочено: <span className="numeral text-[var(--due)]">{formatMoney(416000, 'UAH')}</span>
        </span>
      </div>
    </LabSection>
  );
}

function CommandPalettePattern() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'k' && (event.metaKey || event.ctrlKey)) {
        event.preventDefault();
        setOpen((value) => !value);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, []);

  return (
    <LabSection
      title="Командна палітра"
      description="Щоденний інструмент відкривається з клавіатури. Cmd/Ctrl + K — і одразу потрібний учень або дія."
    >
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="outline" onClick={() => setOpen(true)}>
          <CommandIcon data-icon="inline-start" />
          Відкрити палітру
        </Button>
        <span className="text-muted-foreground text-xs">
          або натисніть <kbd className="border-border rounded border px-1.5 py-0.5">Ctrl</kbd> +{' '}
          <kbd className="border-border rounded border px-1.5 py-0.5">K</kbd>
        </span>
      </div>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Швидкі дії"
        description="Пошук учнів і команд"
      >
        <CommandInput placeholder="Учень, група або дія…" />
        <CommandList>
          <CommandEmpty>Нічого не знайдено</CommandEmpty>
          <CommandGroup heading="Учні">
            {STUDENTS.slice(0, 3).map((student) => (
              <CommandItem key={student.id} value={student.name}>
                <Avatar className="size-6">
                  <AvatarFallback className="text-[10px]">{student.initials}</AvatarFallback>
                </Avatar>
                {student.name}
              </CommandItem>
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading="Дії">
            <CommandItem value="Продати абонемент">
              <ReceiptIcon />
              Продати абонемент
            </CommandItem>
            <CommandItem value="Записати платіж">
              <PlusIcon />
              Записати платіж
            </CommandItem>
            <CommandItem value="Нагадати про оплату">
              <SendIcon />
              Нагадати про оплату
            </CommandItem>
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </LabSection>
  );
}

function NotificationsPattern() {
  return (
    <LabSection
      title="Сповіщення"
      description="Кожне сповіщення веде до дії. Те, що не потребує дії, сюди не потрапляє."
    >
      <div className="grid gap-5 lg:grid-cols-2">
        <LabBlock label="Є що робити">
          <LabStage padded={false}>
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <span className="text-sm font-medium">Сповіщення</span>
              <Badge variant="secondary">3</Badge>
            </div>
            <Separator />
            <div className="divide-border divide-y">
              {[
                {
                  icon: ReceiptIcon,
                  title: 'Абонемент Богдана добігає кінця',
                  hint: 'Залишилось 2 з 8 занять',
                  action: 'Продати',
                },
                {
                  icon: AlertCircleIcon,
                  title: 'Марʼяна не сплатила 9 днів',
                  hint: `${formatMoney(104000, 'UAH')} заборгованості`,
                  action: 'Нагадати',
                },
                {
                  icon: ClockIcon,
                  title: 'Заняття о 18:30 без підтвердження',
                  hint: 'Аліса Демченко',
                  action: 'Підтвердити',
                },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 px-4 py-3">
                  <item.icon className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden="true" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm">{item.title}</span>
                    <span className="text-muted-foreground text-xs">{item.hint}</span>
                  </div>
                  <Button size="xs" variant="outline" className="shrink-0">
                    {item.action}
                  </Button>
                </div>
              ))}
            </div>
          </LabStage>
        </LabBlock>

        <LabBlock label="Порожньо" hint="повноцінний стан, а не сірий текст">
          <LabStage>
            <Empty>
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <CheckIcon />
                </EmptyMedia>
                <EmptyTitle>Усе під контролем</EmptyTitle>
                <EmptyDescription>
                  Абонементи не закінчуються, боргів немає. Наступне заняття о 14:00.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          </LabStage>
        </LabBlock>
      </div>
    </LabSection>
  );
}

function OnboardingPattern() {
  return (
    <LabSection
      title="Перший запуск"
      description="Порожній простір — це запрошення до дії, а не повідомлення про відсутність даних."
    >
      <LabStage className="max-w-2xl">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h3 className="workbook text-xl font-semibold">Почнімо з першого учня</h3>
            <p className="text-muted-foreground text-sm">
              Три кроки — і Tutorio почне рахувати заняття та гроші замість вас.
            </p>
          </div>

          <Progress value={33} aria-label="Прогрес налаштування" />

          <ol className="flex flex-col gap-3">
            {[
              { done: true, title: 'Створити простір', hint: 'Готово' },
              { done: false, title: 'Додати учня', hint: 'Імʼя й часовий пояс — усе' },
              { done: false, title: 'Продати перший абонемент', hint: 'Далі все рахується саме' },
            ].map((step, index) => (
              <li key={step.title} className="flex items-start gap-3">
                <span
                  className={cn(
                    'numeral grid size-6 shrink-0 place-items-center rounded-full text-xs',
                    step.done
                      ? 'bg-[var(--settled)] text-white'
                      : 'border-border text-muted-foreground border',
                  )}
                >
                  {step.done ? <CheckIcon className="size-3.5" aria-hidden="true" /> : index + 1}
                </span>
                <div className="flex flex-col">
                  <span className={cn('text-sm', step.done && 'text-muted-foreground line-through')}>
                    {step.title}
                  </span>
                  <span className="text-muted-foreground text-xs">{step.hint}</span>
                </div>
              </li>
            ))}
          </ol>

          <Button className="w-fit">
            <PlusIcon data-icon="inline-start" />
            Додати учня
          </Button>
        </div>
      </LabStage>
    </LabSection>
  );
}

function ResponsivePattern() {
  return (
    <LabSection
      title="Адаптивність"
      description="На телефоні викладач має за кілька секунд побачити наступне заняття, баланс учня і закрити дію."
    >
      <div className="flex flex-wrap items-start gap-6">
        <LabBlock label="Телефон" hint="375 px">
          <div
            className="border-border bg-background overflow-hidden rounded-xl border"
            style={{ width: 340 }}
          >
            <div className="border-border flex items-center justify-between border-b px-4 py-3">
              <span className="workbook text-sm font-semibold">Понеділок, 20 липня</span>
              <BellIcon className="text-muted-foreground size-4" aria-hidden="true" />
            </div>

            <div className="bg-accent/60 border-border flex flex-col gap-2 border-b p-4">
              <span className="register-label">Зараз</span>
              <span className="text-sm font-medium">Група B1 «Вечірня»</span>
              <span className="text-muted-foreground text-xs">11:00–12:30 · залишилось 18 хв</span>
              <Button size="sm" className="w-full">
                <CheckIcon data-icon="inline-start" />
                Провести
              </Button>
            </div>

            <div className="divide-border divide-y">
              {TODAY_LESSONS.slice(2).map((lesson) => (
                <div key={lesson.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="numeral text-muted-foreground w-11 shrink-0 text-sm">
                    {lesson.time}
                  </span>
                  <span className="flex-1 truncate text-sm">{lesson.student}</span>
                  <Button size="xs" variant="ghost" className="shrink-0">
                    Провести
                  </Button>
                </div>
              ))}
            </div>

            <div className="border-border flex flex-col gap-2 border-t p-4">
              <span className="register-label">Потребує уваги</span>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <Avatar className="size-6">
                    <AvatarFallback className="text-[10px]">МК</AvatarFallback>
                  </Avatar>
                  <span className="truncate text-sm">Марʼяна Ковальчук</span>
                </div>
                <StatusBadge status="overdue" />
              </div>
              <RegisterStrip used={8} total={8} size="sm" />
              <Button size="sm" variant="outline" className="w-full">
                Нагадати про оплату
              </Button>
            </div>

            {/* Bottom bar: thumb-reachable primary navigation on a phone. */}
            <div className="border-border bg-card grid grid-cols-4 border-t">
              {[
                { Icon: ClockIcon, label: 'День', active: true },
                { Icon: UsersIcon, label: 'Учні', active: false },
                { Icon: ReceiptIcon, label: 'Гроші', active: false },
                { Icon: SearchIcon, label: 'Пошук', active: false },
              ].map((tab) => (
                <span
                  key={tab.label}
                  className={cn(
                    'flex flex-col items-center gap-1 py-2.5 text-[11px]',
                    tab.active ? 'text-primary' : 'text-muted-foreground',
                  )}
                >
                  <tab.Icon className="size-4" aria-hidden="true" />
                  {tab.label}
                </span>
              ))}
            </div>
          </div>
        </LabBlock>

        <LabBlock label="Планшет" hint="768 px — поля переїжджають вниз">
          <div
            className="border-border bg-background overflow-hidden rounded-xl border p-4"
            style={{ width: 380 }}
          >
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <span className="workbook text-base font-semibold">Розклад дня</span>
                <Button size="xs" variant="outline">
                  <PlusIcon data-icon="inline-start" />
                  Заняття
                </Button>
              </div>
              <div className="divide-border divide-y">
                {TODAY_LESSONS.slice(0, 3).map((lesson) => (
                  <div key={lesson.id} className="flex items-center gap-3 py-2.5">
                    <span className="numeral text-muted-foreground w-11 text-sm">{lesson.time}</span>
                    <span className="flex-1 truncate text-sm">{lesson.student}</span>
                    <Button size="xs" variant="ghost">
                      Провести
                    </Button>
                  </div>
                ))}
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                <span className="register-label">Потребує уваги</span>
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="flex min-w-0 items-center gap-2">
                    <Avatar className="size-6">
                      <AvatarFallback className="text-[10px]">БМ</AvatarFallback>
                    </Avatar>
                    <span className="truncate">Богдан Мельник</span>
                  </div>
                  <RegisterStrip used={6} total={8} size="sm" showCount={false} />
                </div>
              </div>
            </div>
          </div>
        </LabBlock>
      </div>
    </LabSection>
  );
}
