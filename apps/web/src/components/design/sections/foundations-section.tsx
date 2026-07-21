import { RegisterStrip } from '@/components/design/register-strip';
import { STATUSES, StatusBadge, type StatusKey } from '@/components/design/status-badge';
import { LabBlock, LabSection } from '@/components/design/lab-kit';
import {
  BanknoteIcon,
  CalendarDaysIcon,
  CheckIcon,
  ClockIcon,
  GraduationCapIcon,
  PauseIcon,
  ReceiptIcon,
  SearchIcon,
  SendIcon,
  TrashIcon,
  TriangleAlertIcon,
  UsersIcon,
} from 'lucide-react';

// TailAdmin's colour system: a brand ramp, the Untitled-UI grey ramp, and three
// semantic families. Values are the design tokens themselves so a swatch is the
// real pixel, not an approximation.
const BRAND_RAMP = [
  { step: '50', hex: '#ecf3ff' },
  { step: '100', hex: '#dde9ff' },
  { step: '400', hex: '#7592ff' },
  { step: '500', hex: '#465fff' },
  { step: '600', hex: '#3641f5' },
  { step: '700', hex: '#2a31d8' },
];

const GRAY_RAMP = [
  { step: '50', hex: '#f9fafb' },
  { step: '100', hex: '#f2f4f7' },
  { step: '200', hex: '#e4e7ec' },
  { step: '300', hex: '#d0d5dd' },
  { step: '400', hex: '#98a2b3' },
  { step: '500', hex: '#667085' },
  { step: '700', hex: '#344054' },
  { step: '900', hex: '#101828' },
];

const SEMANTIC = [
  { name: 'Success', role: 'Оплачено, здорово', hex: '#12b76a', wash: '#ecfdf3' },
  { name: 'Error', role: 'Борг, прострочення', hex: '#f04438', wash: '#fef3f2' },
  { name: 'Warning', role: 'Увага, призупинено', hex: '#f79009', wash: '#fffaeb' },
  { name: 'Blue light', role: 'Інфо, другорядне', hex: '#0ba5ec', wash: '#f0f9ff' },
];

const TYPE_ROLES = [
  { role: 'Заголовок сторінки', className: 'text-2xl font-semibold', sample: 'Огляд', spec: 'Onest 600 · 24px' },
  { role: 'Заголовок картки', className: 'text-base font-semibold', sample: 'Заняття на тиждень', spec: 'Onest 600 · 16px' },
  { role: 'Число метрики', className: 'numeral text-2xl font-semibold', sample: '1 202 000 ₴', spec: 'Onest 600 · табличні цифри' },
  { role: 'Текст інтерфейсу', className: 'text-sm', sample: 'Абонемент добігає кінця — залишилось два заняття.', spec: 'Onest 400 · 14px' },
  { role: 'Підпис / мітка', className: 'register-label', sample: 'Потребує уваги', spec: 'Onest 500 · 12px · +tracking' },
];

const SHADOWS = [
  { name: 'sm', css: '0px 1px 3px rgba(16,24,40,.1), 0px 1px 2px rgba(16,24,40,.06)' },
  { name: 'md', css: '0px 4px 8px -2px rgba(16,24,40,.1), 0px 2px 4px -2px rgba(16,24,40,.06)' },
  { name: 'lg', css: '0px 12px 16px -4px rgba(16,24,40,.08), 0px 4px 6px -2px rgba(16,24,40,.03)' },
];

const ICONS = [
  { Icon: UsersIcon, label: 'Учні' },
  { Icon: GraduationCapIcon, label: 'Групи' },
  { Icon: CalendarDaysIcon, label: 'Розклад' },
  { Icon: BanknoteIcon, label: 'Платежі' },
  { Icon: ReceiptIcon, label: 'Абонемент' },
  { Icon: ClockIcon, label: 'Заняття' },
  { Icon: CheckIcon, label: 'Проведено' },
  { Icon: PauseIcon, label: 'Призупинено' },
  { Icon: TriangleAlertIcon, label: 'Увага' },
  { Icon: SendIcon, label: 'Нагадати' },
  { Icon: SearchIcon, label: 'Пошук' },
  { Icon: TrashIcon, label: 'У кошик' },
];

function Swatch({ hex, step }: { hex: string; step: string }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="border-border size-12 rounded-lg border" style={{ backgroundColor: hex }} />
      <code className="text-muted-foreground text-[11px]">{step}</code>
    </div>
  );
}

export function FoundationsSection() {
  return (
    <div className="flex flex-col gap-10">
      <LabSection
        title="Колір"
        description="Брендовий синій #465FFF несе дію та акцент. Нейтральна шкала Untitled UI будує поверхні й текст, а три семантичні родини — статуси та гроші."
        className="border-t-0 pt-0"
      >
        <LabBlock label="Бренд" hint="акцент, головна дія, активний стан">
          <div className="flex flex-wrap gap-3">
            {BRAND_RAMP.map((c) => (
              <Swatch key={c.step} hex={c.hex} step={c.step} />
            ))}
          </div>
        </LabBlock>

        <LabBlock label="Нейтральна шкала" hint="фон, межі, текст">
          <div className="flex flex-wrap gap-3">
            {GRAY_RAMP.map((c) => (
              <Swatch key={c.step} hex={c.hex} step={c.step} />
            ))}
          </div>
        </LabBlock>

        <LabBlock label="Семантичні">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {SEMANTIC.map((s) => (
              <div
                key={s.name}
                className="border-border flex items-center gap-3 rounded-xl border p-3"
                style={{ backgroundColor: s.wash }}
              >
                <span className="size-9 shrink-0 rounded-lg" style={{ backgroundColor: s.hex }} />
                <div className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium" style={{ color: s.hex }}>
                    {s.name}
                  </span>
                  <span className="text-xs" style={{ color: s.hex }}>
                    {s.role}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </LabBlock>

        <LabBlock label="Поверхні" hint="картка лежить на сірій сторінці">
          <div className="flex flex-wrap gap-3">
            {['background', 'card', 'muted', 'accent', 'popover'].map((surface) => (
              <div key={surface} className="flex flex-col items-center gap-1.5">
                <span
                  className="border-border size-16 rounded-xl border"
                  style={{ backgroundColor: `var(--${surface})` }}
                />
                <code className="text-muted-foreground text-[11px]">{surface}</code>
              </div>
            ))}
          </div>
        </LabBlock>
      </LabSection>

      <LabSection
        title="Типографіка"
        description="Одна гарнітура — Onest, геометричний гротеск, близький до Outfit з демо TailAdmin, але з повною кирилицею. Заголовки, числа й текст живуть в одному шрифті."
      >
        <div className="flex flex-col">
          {TYPE_ROLES.map((role, index) => (
            <div
              key={role.role}
              className={`flex flex-col gap-1.5 py-4 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6 ${
                index > 0 ? 'border-border border-t' : ''
              }`}
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="register-label">{role.role}</span>
                <span className={role.className}>{role.sample}</span>
              </div>
              <code className="text-muted-foreground shrink-0 text-xs">{role.spec}</code>
            </div>
          ))}
        </div>

        <LabBlock label="Кирилиця" hint="діакритика, апостроф, специфічні літери">
          <p className="text-lg">Їжак ґанок щавель — Марʼяна, Софія, Ігор · 0123456789</p>
        </LabBlock>
      </LabSection>

      <LabSection
        title="Форма й глибина"
        description="Картки заокруглені на 16px і підняті мʼякою тінню над сірою сторінкою — фірмовий прийом TailAdmin. Кнопки та поля тримають 8px."
      >
        <div className="grid gap-6 sm:grid-cols-2">
          <LabBlock label="Тіні">
            <div className="flex flex-wrap gap-5">
              {SHADOWS.map((shadow) => (
                <div key={shadow.name} className="flex flex-col items-center gap-2">
                  <span
                    className="bg-card size-16 rounded-2xl"
                    style={{ boxShadow: shadow.css }}
                  />
                  <code className="text-muted-foreground text-[11px]">{shadow.name}</code>
                </div>
              ))}
            </div>
          </LabBlock>

          <LabBlock label="Радіуси">
            <div className="flex flex-wrap items-end gap-3">
              {[
                { name: 'md', cls: 'rounded-md' },
                { name: 'lg', cls: 'rounded-lg' },
                { name: 'xl', cls: 'rounded-xl' },
                { name: '2xl', cls: 'rounded-2xl' },
                { name: 'full', cls: 'rounded-full' },
              ].map((radius) => (
                <div key={radius.name} className="flex flex-col items-center gap-1.5">
                  <span className={`bg-muted border-border size-12 border ${radius.cls}`} />
                  <code className="text-muted-foreground text-[11px]">{radius.name}</code>
                </div>
              ))}
            </div>
          </LabBlock>
        </div>

        <LabBlock label="Відступи" hint="кратні 4px">
          <div className="flex items-end gap-3">
            {[1, 2, 3, 4, 6, 8].map((step) => (
              <div key={step} className="flex flex-col items-center gap-1.5">
                <span className="bg-primary/70 w-3 rounded-sm" style={{ height: `${step * 4}px` }} />
                <code className="text-muted-foreground text-[11px]">{step * 4}</code>
              </div>
            ))}
          </div>
        </LabBlock>
      </LabSection>

      <LabSection
        title="Статуси"
        description="Шість станів продукту як «світлі» бейджі TailAdmin: фон-відтінок 50, текст 600. «Скасовано» додатково несе закреслення, щоб стан читався і без кольору."
      >
        <div className="flex flex-wrap gap-2">
          {(Object.keys(STATUSES) as StatusKey[]).map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </LabSection>

      <LabSection
        title="Клітинки абонемента"
        description="Підпис системи. Абонемент — це рядок класного журналу: одна клітинка на одне заняття. Порожні клітинки беруть червону обведення, коли занять лишається мало."
      >
        <div className="grid gap-5 sm:grid-cols-2">
          <LabBlock label="Щойно куплений" hint="10 занять, жодного проведеного">
            <RegisterStrip used={0} total={10} />
          </LabBlock>
          <LabBlock label="У роботі" hint="більшість занять попереду">
            <RegisterStrip used={3} total={10} />
          </LabBlock>
          <LabBlock label="Закінчується" hint="порожні клітинки беруть обведення">
            <RegisterStrip used={8} total={10} />
          </LabBlock>
          <LabBlock label="Вичерпаний" hint="час продавати наступний">
            <RegisterStrip used={10} total={10} />
          </LabBlock>
        </div>
      </LabSection>

      <LabSection
        title="Іконки"
        description="Lucide, товщина 2px, розмір 16 або 20. Іконка ніколи не замінює підпис у навігації."
      >
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {ICONS.map(({ Icon, label }) => (
            <div
              key={label}
              className="border-border flex flex-col items-center gap-2 rounded-xl border p-3"
            >
              <Icon className="size-5" aria-hidden="true" />
              <span className="text-muted-foreground text-center text-[11px]">{label}</span>
            </div>
          ))}
        </div>
      </LabSection>
    </div>
  );
}
