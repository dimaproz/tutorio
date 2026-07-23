import { Flag, type FlagCode } from '@/components/app/flag';

// Flag + symbol metadata for the currencies the workspace supports. The flag is
// the issuing country/union; the symbol is what people recognise at a glance.
export const CURRENCY_META: Record<string, { flag: FlagCode; symbol: string }> = {
  EUR: { flag: 'eu', symbol: '€' },
  UAH: { flag: 'ua', symbol: '₴' },
  PLN: { flag: 'pl', symbol: 'zł' },
  USD: { flag: 'us', symbol: '$' },
  GBP: { flag: 'gb', symbol: '£' },
};

// Row shown inside a currency <SelectItem> (and, via SelectValue, in the closed
// trigger): flag, three-letter code, and the symbol trailing in muted grey.
export function CurrencyOption({ code }: { code: string }) {
  const meta = CURRENCY_META[code];
  return (
    <span className="flex items-center gap-2">
      {meta ? <Flag code={meta.flag} /> : null}
      <span>{code}</span>
      {meta ? <span className="text-muted-foreground">{meta.symbol}</span> : null}
    </span>
  );
}
