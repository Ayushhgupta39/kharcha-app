import {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  format as fnsFormat,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
} from 'date-fns';

export function toIso(d: Date): string {
  return d.toISOString();
}

export function dayIso(d: Date): string {
  return fnsFormat(d, 'yyyy-MM-dd');
}

export function todayStart(): string {
  return startOfDay(new Date()).toISOString();
}

export function todayEnd(): string {
  return endOfDay(new Date()).toISOString();
}

export function rangeToday() {
  const now = new Date();
  return { from: startOfDay(now).toISOString(), to: endOfDay(now).toISOString() };
}

export function rangeThisMonth() {
  const now = new Date();
  return {
    from: startOfMonth(now).toISOString(),
    to: endOfMonth(now).toISOString(),
  };
}

export function rangeThisWeek() {
  const now = new Date();
  return {
    from: startOfWeek(now, { weekStartsOn: 1 }).toISOString(),
    to: endOfWeek(now, { weekStartsOn: 1 }).toISOString(),
  };
}

export function rangeThisYear() {
  const now = new Date();
  return {
    from: startOfYear(now).toISOString(),
    to: endOfYear(now).toISOString(),
  };
}

export function rangeLastNDays(n: number) {
  const now = new Date();
  return {
    from: startOfDay(subDays(now, n - 1)).toISOString(),
    to: endOfDay(now).toISOString(),
  };
}

export {
  addDays,
  endOfDay,
  endOfMonth,
  endOfWeek,
  endOfYear,
  fnsFormat as format,
  isSameDay,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  startOfYear,
  subDays,
};
