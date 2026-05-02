import { format as fnsFormat, isToday, isYesterday, parseISO } from 'date-fns';

// Amounts are stored in paise (integer) to avoid float math.
export function paiseToRupees(paise: number): number {
  return paise / 100;
}

export function formatAmount(paise: number, opts: { signed?: boolean } = {}): string {
  const rupees = Math.abs(paise) / 100;
  const sign = opts.signed && paise < 0 ? '-' : '';
  return sign + '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

// Compact format for UI display: up to 99,999 shown as-is, then K / L / Cr
export function formatAmountCompact(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  if (rupees < 1_00_000) {
    return '₹' + rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  }
  if (rupees < 1_00_00_000) {
    const l = rupees / 1_00_000;
    return '₹' + (l >= 10 ? l.toFixed(1) : l.toFixed(2)).replace(/\.?0+$/, '') + 'L';
  }
  const cr = rupees / 1_00_00_000;
  return '₹' + (cr >= 10 ? cr.toFixed(1) : cr.toFixed(2)).replace(/\.?0+$/, '') + 'Cr';
}

export function formatAmountDetailed(paise: number): string {
  const rupees = Math.abs(paise) / 100;
  return (
    '₹' +
    rupees.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function formatDayHeader(iso: string): string {
  const d = parseISO(iso);
  if (isToday(d)) return 'TODAY · ' + fnsFormat(d, 'MMM d').toUpperCase();
  if (isYesterday(d)) return 'YESTERDAY · ' + fnsFormat(d, 'MMM d').toUpperCase();
  return fnsFormat(d, 'EEE · MMM d').toUpperCase();
}

export function formatTime(iso: string): string {
  return fnsFormat(parseISO(iso), 'HH:mm');
}

export function formatDate(iso: string): string {
  return fnsFormat(parseISO(iso), 'MMM d, yyyy');
}

export function toDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function todayKey(): string {
  return fnsFormat(new Date(), 'yyyy-MM-dd');
}
