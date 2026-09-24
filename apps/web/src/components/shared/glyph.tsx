import {
  AlertCircleIcon,
  ArchiveIcon,
  ArrowLeftIcon,
  ArrowLeftRightIcon,
  ArrowRightIcon,
  ArrowUpDownIcon,
  BellIcon,
  BoxIcon,
  Building2Icon,
  CalendarIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  ClockIcon,
  EllipsisIcon,
  EllipsisVerticalIcon,
  EyeIcon,
  EyeOffIcon,
  FileTextIcon,
  GraduationCapIcon,
  HeartIcon,
  HomeIcon,
  KeyboardIcon,
  LayersIcon,
  LayoutGridIcon,
  ListIcon,
  Loader2Icon,
  LockIcon,
  MailIcon,
  MoonIcon,
  PauseIcon,
  PencilIcon,
  PhoneIcon,
  PlayIcon,
  PlusIcon,
  RotateCcwIcon,
  SearchIcon,
  SearchXIcon,
  SendIcon,
  SettingsIcon,
  SlidersHorizontalIcon,
  SunIcon,
  UserIcon,
  UsersIcon,
  VideoIcon,
  WalletCardsIcon,
  XIcon,
  type LucideIcon,
} from 'lucide-react';

/**
 * The handoff's stroke set, keyed by the design's own names and drawn
 * with the project's Lucide icons. Components that take a `glyph` prop read
 * this map, so a design reference like `icon="cal"` translates one to one.
 */
export const GLYPHS = {
  home: HomeIcon,
  cal: CalendarIcon,
  users: UsersIcon,
  layers: LayersIcon,
  heart: HeartIcon,
  cap: GraduationCapIcon,
  box: BoxIcon,
  wallet: WalletCardsIcon,
  search: SearchIcon,
  bell: BellIcon,
  plus: PlusIcon,
  more: EllipsisIcon,
  down: ChevronDownIcon,
  clock: ClockIcon,
  phone: PhoneIcon,
  send: SendIcon,
  mail: MailIcon,
  left: ArrowLeftIcon,
  arrow: ArrowRightIcon,
  gear: SettingsIcon,
  filter: SlidersHorizontalIcon,
  list: ListIcon,
  grid: LayoutGridIcon,
  pencil: PencilIcon,
  video: VideoIcon,
  sort: ArrowUpDownIcon,
  check: CheckIcon,
  sun: SunIcon,
  moon: MoonIcon,
  moreV: EllipsisVerticalIcon,
  eye: EyeIcon,
  eyeOff: EyeOffIcon,
  lock: LockIcon,
  user: UserIcon,
  alert: AlertCircleIcon,
  loader: Loader2Icon,
  x: XIcon,
  chevUp: ChevronUpIcon,
  pause: PauseIcon,
  archive: ArchiveIcon,
  restore: RotateCcwIcon,
  play: PlayIcon,
  note: FileTextIcon,
  right: ChevronRightIcon,
  building: Building2Icon,
  // The lesson form (S02): a typed time, a substitute teacher, a search with no result.
  keyboard: KeyboardIcon,
  swap: ArrowLeftRightIcon,
  searchX: SearchXIcon,
} as const satisfies Record<string, LucideIcon>;

export type GlyphName = keyof typeof GLYPHS;

export const GLYPH_NAMES = Object.keys(GLYPHS) as GlyphName[];

/** One design glyph. Decorative by default: its control carries the name. */
export function Glyph({
  name,
  className,
  strokeWidth,
}: {
  name: GlyphName;
  className?: string;
  strokeWidth?: number;
}) {
  const Icon = GLYPHS[name];
  return <Icon aria-hidden="true" className={className} strokeWidth={strokeWidth} />;
}
