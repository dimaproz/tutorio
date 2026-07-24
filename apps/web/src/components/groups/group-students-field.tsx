'use client';

import { PlusIcon, Trash2Icon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import type { CurrencyCodeDto } from '@tutorio/validation';
import { Button } from '@/components/ui/button';
import { FieldLabel } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useStudentsQuery } from '@/lib/api/students';
import { useTeachersQuery } from '@/lib/api/teachers';

// One editable enrollment row in the group form. enrollmentId present = an
// existing member (kept unless removed); absent = a new enrollment to create.
export interface GroupMemberRow {
  key: string;
  enrollmentId?: string;
  studentId: string;
  teacherId: string;
  price: string;
  currency: CurrencyCodeDto;
}

const CURRENCIES: CurrencyCodeDto[] = ['EUR', 'UAH', 'PLN', 'USD', 'GBP'];

let rowSeq = 0;
export function newMemberRow(currency: CurrencyCodeDto): GroupMemberRow {
  rowSeq += 1;
  return { key: `row-${rowSeq}`, studentId: '', teacherId: '', price: '', currency };
}

export function GroupStudentsField({
  rows,
  onChange,
  defaultCurrency,
  enabled,
}: {
  rows: GroupMemberRow[];
  onChange: (rows: GroupMemberRow[]) => void;
  defaultCurrency: CurrencyCodeDto;
  enabled: boolean;
}) {
  const t = useTranslations('groups.form.students');
  const students = useStudentsQuery({ page: 1, pageSize: 100 }, enabled);
  const teachers = useTeachersQuery({ page: 1, pageSize: 100 }, enabled);

  const update = (key: string, patch: Partial<GroupMemberRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  const pickedStudentIds = new Set(rows.map((row) => row.studentId).filter(Boolean));

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <FieldLabel>{t('section')}</FieldLabel>
      </div>
      <p className="-mt-2 text-xs text-muted-foreground">{t('hint')}</p>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('none')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {rows.map((row) => (
            <div
              key={row.key}
              className="grid grid-cols-1 gap-2 rounded-lg border p-2 sm:grid-cols-[1fr_1fr_auto_auto]"
            >
              <Select
                value={row.studentId}
                onValueChange={(value) => {
                  const student = students.data?.items.find((item) => item.id === value);
                  update(row.key, {
                    studentId: value,
                    // Prefill price/currency from the student's default.
                    price:
                      row.price ||
                      (student?.hourlyRateMinor != null
                        ? String(student.hourlyRateMinor / 100)
                        : ''),
                    currency: (student?.currency as CurrencyCodeDto) ?? row.currency,
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('pickStudent')} />
                </SelectTrigger>
                <SelectContent>
                  {(students.data?.items ?? [])
                    .filter(
                      (item) => item.id === row.studentId || !pickedStudentIds.has(item.id),
                    )
                    .map((item) => (
                      <SelectItem key={item.id} value={item.id}>
                        {item.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <Select
                value={row.teacherId}
                onValueChange={(value) => {
                  const teacher = teachers.data?.items.find((item) => item.id === value);
                  update(row.key, {
                    teacherId: value,
                    price:
                      row.price ||
                      (teacher?.defaultRateMinor != null
                        ? String(teacher.defaultRateMinor / 100)
                        : ''),
                  });
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('pickTeacher')} />
                </SelectTrigger>
                <SelectContent>
                  {(teachers.data?.items ?? []).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                className="w-24"
                placeholder={t('price')}
                value={row.price}
                onChange={(event) => update(row.key, { price: event.target.value })}
              />
              <Select
                value={row.currency}
                onValueChange={(value) => update(row.key, { currency: value as CurrencyCodeDto })}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((code) => (
                    <SelectItem key={code} value={code}>
                      {code}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="sm:col-span-4 sm:w-full"
                onClick={() => onChange(rows.filter((item) => item.key !== row.key))}
                aria-label={t('remove')}
              >
                <Trash2Icon className="size-4" />
              </Button>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="self-start"
        onClick={() => onChange([...rows, newMemberRow(defaultCurrency)])}
      >
        <PlusIcon className="size-4" />
        {t('add')}
      </Button>
    </div>
  );
}
