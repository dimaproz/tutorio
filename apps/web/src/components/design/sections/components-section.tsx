'use client';

import { useState } from 'react';
import {
  CalendarIcon,
  ChevronDownIcon,
  MoreHorizontalIcon,
  PlusIcon,
  SearchIcon,
  SendIcon,
  SlidersHorizontalIcon,
  TrashIcon,
} from 'lucide-react';
import { toast } from 'sonner';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
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
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Skeleton } from '@/components/ui/skeleton';
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { LabBlock, LabSection } from '@/components/design/lab-kit';
import { Sparkline } from '@/components/design/sparkline';
import { StatusBadge } from '@/components/design/status-badge';
import { formatMoney, LESSONS_PER_WEEK, STUDENTS } from '@/components/design/demo-data';

export function ComponentsSection() {
  return (
    <div className="flex flex-col gap-10">
      <ButtonsBlock />
      <FormsBlock />
      <SelectionBlock />
      <DisplayBlock />
      <TableBlock />
      <SurfacesBlock />
      <FeedbackBlock />
      <ChartStatesBlock />
    </div>
  );
}

function ButtonsBlock() {
  return (
    <LabSection
      title="Кнопки"
      description="На екрані одна головна дія. Решта тихіші за визначенням: outline для другорядного, ghost для третинного."
      className="border-t-0 pt-0"
    >
      <LabBlock label="Варіанти">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Продати абонемент</Button>
          <Button variant="outline">Перенести</Button>
          <Button variant="secondary">Чернетка</Button>
          <Button variant="ghost">Скасувати</Button>
          <Button variant="link">Детальніше</Button>
          <Button variant="destructive">
            <TrashIcon data-icon="inline-start" />У кошик
          </Button>
        </div>
      </LabBlock>

      <LabBlock label="Розміри">
        <div className="flex flex-wrap items-center gap-2">
          <Button size="xs">xs</Button>
          <Button size="sm">sm</Button>
          <Button>default</Button>
          <Button size="lg">lg</Button>
          <Button size="icon" aria-label="Додати учня">
            <PlusIcon />
          </Button>
        </div>
      </LabBlock>

      <LabBlock label="Стани" hint="увімкнено, у процесі, вимкнено">
        <div className="flex flex-wrap items-center gap-2">
          <Button>
            <SendIcon data-icon="inline-start" />
            Надіслати
          </Button>
          <Button disabled>
            <Spinner data-icon="inline-start" />
            Надсилаємо…
          </Button>
          <Button disabled>Недоступно</Button>
          <Button variant="outline" disabled>
            Недоступно
          </Button>
        </div>
      </LabBlock>
    </LabSection>
  );
}

function FormsBlock() {
  const [value, setValue] = useState('');

  return (
    <LabSection
      title="Поля вводу"
      description="Помилка показується поруч із полем і пояснює, як її виправити. Обовʼязкові поля позначені, а не здогадуються."
    >
      <div className="grid gap-6 md:grid-cols-2">
        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="demo-name">Імʼя та прізвище</FieldLabel>
            <Input id="demo-name" placeholder="Марʼяна Ковальчук" autoComplete="name" />
          </Field>

          <Field data-invalid>
            <FieldLabel htmlFor="demo-email">Ел. пошта</FieldLabel>
            <Input
              id="demo-email"
              type="email"
              defaultValue="mariana@"
              aria-invalid
              autoComplete="email"
            />
            <FieldError errors={[{ message: 'Схоже, адреса неповна — додайте домен після «@».' }]} />
          </Field>

          <Field>
            <FieldLabel htmlFor="demo-search">Пошук</FieldLabel>
            <InputGroup>
              <InputGroupAddon>
                <SearchIcon aria-hidden="true" />
              </InputGroupAddon>
              <InputGroupInput
                id="demo-search"
                type="search"
                placeholder="Імʼя, пошта або телефон…"
                value={value}
                onChange={(event) => setValue(event.target.value)}
              />
            </InputGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="demo-notes">Нотатки</FieldLabel>
            <Textarea id="demo-notes" rows={3} placeholder="Готується до іспиту B2 навесні" />
            <FieldDescription>Бачить лише викладач.</FieldDescription>
          </Field>
        </div>

        <div className="flex flex-col gap-4">
          <Field>
            <FieldLabel htmlFor="demo-select">Тип оплати</FieldLabel>
            <Select defaultValue="package">
              <SelectTrigger id="demo-select" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectGroup>
                  <SelectItem value="package">Абонемент</SelectItem>
                  <SelectItem value="monthly">Помісячно</SelectItem>
                  <SelectItem value="lesson">За заняття</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel>Учень</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                  Оберіть учня
                  <ChevronDownIcon data-icon className="opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Пошук учня…" />
                  <CommandList>
                    <CommandEmpty>Нікого не знайдено</CommandEmpty>
                    <CommandGroup>
                      {STUDENTS.slice(0, 4).map((student) => (
                        <CommandItem key={student.id} value={student.name}>
                          {student.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </Field>

          <Field>
            <FieldLabel>Дата заняття</FieldLabel>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-start font-normal">
                  <CalendarIcon data-icon="inline-start" />
                  20 липня 2026
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="single" defaultMonth={new Date('2026-07-20')} />
              </PopoverContent>
            </Popover>
          </Field>
        </div>
      </div>
    </LabSection>
  );
}

function SelectionBlock() {
  return (
    <LabSection title="Вибір" description="Прапорці, перемикачі та сегментований контрол.">
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <LabBlock label="Прапорці">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Checkbox id="c1" defaultChecked />
              <Label htmlFor="c1" className="font-normal">
                Нагадувати про оплату
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="c2" />
              <Label htmlFor="c2" className="font-normal">
                Дублювати батькам
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox id="c3" disabled />
              <Label htmlFor="c3" className="text-muted-foreground font-normal">
                Недоступно
              </Label>
            </div>
          </div>
        </LabBlock>

        <LabBlock label="Перемикачі">
          <RadioGroup defaultValue="default" className="gap-2.5">
            <div className="flex items-center gap-2">
              <RadioGroupItem value="default" id="r1" />
              <Label htmlFor="r1" className="font-normal">
                Дедлайн простору
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <RadioGroupItem value="custom" id="r2" />
              <Label htmlFor="r2" className="font-normal">
                Власний дедлайн
              </Label>
            </div>
          </RadioGroup>
        </LabBlock>

        <LabBlock label="Тумблер">
          <div className="flex flex-col gap-2.5">
            <div className="flex items-center gap-2">
              <Switch id="s1" defaultChecked />
              <Label htmlFor="s1" className="font-normal">
                Автонагадування
              </Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch id="s2" />
              <Label htmlFor="s2" className="font-normal">
                Копія на пошту
              </Label>
            </div>
          </div>
        </LabBlock>

        <LabBlock label="Сегменти">
          <ToggleGroup type="single" defaultValue="week" variant="outline" size="sm">
            <ToggleGroupItem value="day">День</ToggleGroupItem>
            <ToggleGroupItem value="week">Тиждень</ToggleGroupItem>
            <ToggleGroupItem value="month">Місяць</ToggleGroupItem>
          </ToggleGroup>
        </LabBlock>
      </div>
    </LabSection>
  );
}

function DisplayBlock() {
  return (
    <LabSection title="Позначки й підказки" description="Бейджі, аватари, підказки, меню.">
      <div className="grid gap-6 sm:grid-cols-2">
        <LabBlock label="Бейджі">
          <div className="flex flex-wrap gap-2">
            <StatusBadge status="active" />
            <StatusBadge status="overdue" />
            <StatusBadge status="paid" />
            <Badge variant="outline">Абонемент</Badge>
            <Badge variant="secondary">Помісячно</Badge>
          </div>
        </LabBlock>

        <LabBlock label="Аватари">
          <div className="flex items-center gap-2">
            {STUDENTS.slice(0, 4).map((student) => (
              <Avatar key={student.id} className="size-9">
                <AvatarFallback className="text-xs">{student.initials}</AvatarFallback>
              </Avatar>
            ))}
            <span className="text-muted-foreground text-xs">+8</span>
          </div>
        </LabBlock>

        <LabBlock label="Підказка">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm">
                Наведи
              </Button>
            </TooltipTrigger>
            <TooltipContent>Дедлайн скасування: 24 години до заняття</TooltipContent>
          </Tooltip>
        </LabBlock>

        <LabBlock label="Меню">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" aria-label="Дії з учнем">
                <MoreHorizontalIcon />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem>Відкрити картку</DropdownMenuItem>
              <DropdownMenuItem>Продати абонемент</DropdownMenuItem>
              <DropdownMenuItem>Нагадати про оплату</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive">Перемістити в кошик</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </LabBlock>
      </div>
    </LabSection>
  );
}

function TableBlock() {
  const [selected, setSelected] = useState<string[]>([]);
  const allSelected = selected.length === STUDENTS.length;

  return (
    <LabSection
      title="Таблиця"
      description="Фільтри й налаштування колонок зʼявляються на вимогу. Масові дії виникають лише тоді, коли щось обрано."
    >
      <div className="flex flex-wrap items-center gap-2">
        <InputGroup className="w-full sm:max-w-xs">
          <InputGroupAddon>
            <SearchIcon aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput type="search" placeholder="Пошук учнів…" aria-label="Пошук учнів" />
        </InputGroup>
        <Button variant="outline" size="sm">
          <SlidersHorizontalIcon data-icon="inline-start" />
          Фільтри
        </Button>
      </div>

      {selected.length > 0 ? (
        <div className="bg-accent/60 border-border flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2">
          <span className="text-sm">Обрано: {selected.length}</span>
          <div className="flex-1" />
          <Button size="xs" variant="outline">
            Нагадати про оплату
          </Button>
          <Button size="xs" variant="ghost" onClick={() => setSelected([])}>
            Зняти вибір
          </Button>
        </div>
      ) : null}

      <div className="border-border overflow-x-auto rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={allSelected}
                  aria-label="Обрати всіх"
                  onCheckedChange={(checked) =>
                    setSelected(checked === true ? STUDENTS.map((s) => s.id) : [])
                  }
                />
              </TableHead>
              <TableHead>Учень</TableHead>
              <TableHead>Група</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Ціна заняття</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {STUDENTS.map((student) => (
              <TableRow key={student.id} data-state={selected.includes(student.id) ? 'selected' : undefined}>
                <TableCell>
                  <Checkbox
                    checked={selected.includes(student.id)}
                    aria-label={`Обрати ${student.name}`}
                    onCheckedChange={(checked) =>
                      setSelected((prev) =>
                        checked === true
                          ? [...prev, student.id]
                          : prev.filter((id) => id !== student.id),
                      )
                    }
                  />
                </TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      <AvatarFallback className="text-[11px]">{student.initials}</AvatarFallback>
                    </Avatar>
                    {student.name}
                  </div>
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {student.group ?? 'Індивідуально'}
                </TableCell>
                <TableCell>
                  <StatusBadge status={student.status} />
                </TableCell>
                <TableCell className="numeral text-right">
                  {formatMoney(student.priceMinor, student.currency)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious href="#">Назад</PaginationPrevious>
          </PaginationItem>
          <PaginationItem>
            <PaginationLink href="#" aria-current="page">
              Сторінка 1 з 3
            </PaginationLink>
          </PaginationItem>
          <PaginationItem>
            <PaginationNext href="#">Далі</PaginationNext>
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </LabSection>
  );
}

function SurfacesBlock() {
  return (
    <LabSection title="Поверхні" description="Картка, вкладки, акордеон, діалог, шторка.">
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Абонемент</CardTitle>
            <CardDescription>10 занять · Олена Гриценко</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <span className="numeral text-2xl">{formatMoney(450000, 'UAH')}</span>
            <Progress value={30} />
            <span className="text-muted-foreground text-xs">Проведено 3 з 10</span>
          </CardContent>
        </Card>

        <Accordion type="single" collapsible className="border-border rounded-lg border px-4">
          <AccordionItem value="a1">
            <AccordionTrigger>Правила скасування</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm">
              Учень може скасувати заняття без списання за 24 години. Пізніше заняття
              списується з абонемента.
            </AccordionContent>
          </AccordionItem>
          <AccordionItem value="a2">
            <AccordionTrigger>Перенесення</AccordionTrigger>
            <AccordionContent className="text-muted-foreground text-sm">
              Перенести можна двічі на місяць — далі заняття вважається проведеним.
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>

      <div className="flex flex-wrap gap-2">
        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline">Діалог</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Записати платіж</DialogTitle>
              <DialogDescription>
                Платіж зафіксується в історії учня і закриє заборгованість.
              </DialogDescription>
            </DialogHeader>
            <Field>
              <FieldLabel htmlFor="pay-amount">Сума</FieldLabel>
              <Input id="pay-amount" inputMode="decimal" defaultValue="1040" />
            </Field>
            <DialogFooter>
              <Button variant="outline">Скасувати</Button>
              <Button onClick={() => toast.success('Платіж записано')}>Записати</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline">Шторка</Button>
          </SheetTrigger>
          <SheetContent className="gap-0">
            <SheetHeader>
              <SheetTitle>Запис на навчання</SheetTitle>
              <SheetDescription>
                Учень, викладач і правила оплати. Змінити учня після створення не можна.
              </SheetDescription>
            </SheetHeader>
            <div className="flex flex-col gap-4 px-4">
              <Field>
                <FieldLabel htmlFor="sheet-price">Ціна заняття</FieldLabel>
                <Input id="sheet-price" inputMode="decimal" defaultValue="450" />
              </Field>
            </div>
          </SheetContent>
        </Sheet>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Підтвердження</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Перемістити учня в кошик?</AlertDialogTitle>
              <AlertDialogDescription>
                Нічого не зникає назавжди — запис можна відновити. Історія платежів
                зберігається.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Скасувати</AlertDialogCancel>
              <AlertDialogAction>У кошик</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button variant="outline" onClick={() => toast.success('Зміни збережено')}>
          Тост
        </Button>
      </div>
    </LabSection>
  );
}

function FeedbackBlock() {
  return (
    <LabSection
      title="Стани"
      description="Порожньо, завантаження, помилка й успіх — повноцінна робота, а не заглушки."
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <Empty className="border-border border border-dashed">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PlusIcon />
            </EmptyMedia>
            <EmptyTitle>Ще немає учнів</EmptyTitle>
            <EmptyDescription>
              Додайте першого учня — далі зʼявляться розклад і абонементи.
            </EmptyDescription>
          </EmptyHeader>
          <Button size="sm">Додати учня</Button>
        </Empty>

        <div className="border-border flex flex-col gap-3 rounded-lg border p-4">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-24" />
            <Skeleton className="h-8 w-24" />
          </div>
        </div>

        <Alert variant="destructive">
          <AlertTitle>Не вдалося завантажити учнів</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>Перевірте зʼєднання — дані лишились на сервері, нічого не втрачено.</span>
            <Button size="xs" variant="outline">
              Спробувати ще раз
            </Button>
          </AlertDescription>
        </Alert>

        <Alert>
          <AlertTitle>Абонемент завершується</AlertTitle>
          <AlertDescription className="flex flex-col items-start gap-2">
            <span>У Богдана залишилось 2 заняття з 8.</span>
            <Button size="xs" variant="outline">
              Продати наступний
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    </LabSection>
  );
}

function ChartStatesBlock() {
  return (
    <LabSection
      title="Графіки"
      description="Графік зʼявляється лише там, де відповідає на конкретне питання. Один ряд даних не виправдовує окрему бібліотеку — це інлайновий SVG."
    >
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <span className="register-label">З даними</span>
          <span className="numeral text-lg">29</span>
          <Sparkline values={LESSONS_PER_WEEK} label="Занять на тиждень" width={140} />
          <span className="text-muted-foreground text-xs">Занять на тиждень</span>
        </div>

        <div className="border-border flex flex-col gap-2 rounded-lg border p-4">
          <span className="register-label">Завантаження</span>
          <Skeleton className="h-6 w-12" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-3 w-28" />
        </div>

        <div className="border-border flex flex-col justify-center gap-2 rounded-lg border p-4">
          <span className="register-label">Даних ще немає</span>
          <p className="text-muted-foreground text-xs">
            Графік зʼявиться після другого тижня занять.
          </p>
        </div>
      </div>
    </LabSection>
  );
}
