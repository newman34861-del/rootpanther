const NOW = Date.now();

export function minutesAgo(m: number): string {
  return new Date(NOW - m * 60000).toISOString();
}

export function hoursAgo(h: number): string {
  return minutesAgo(h * 60);
}

export function daysAgo(d: number, hour = 20): string {
  const t = new Date(NOW - d * 86400000);
  t.setHours(hour, 12, 0, 0);
  return t.toISOString();
}

export function daysFromNow(d: number): string {
  return new Date(NOW + d * 86400000).toISOString();
}

export function firstOfNextMonth(): string {
  const t = new Date(NOW);
  return new Date(t.getFullYear(), t.getMonth() + 1, 1, 9).toISOString();
}

export function firstOfThisMonth(): string {
  const t = new Date(NOW);
  return new Date(t.getFullYear(), t.getMonth(), 1, 9).toISOString();
}
