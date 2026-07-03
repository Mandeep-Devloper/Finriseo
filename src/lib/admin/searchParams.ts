// Helpers for reading Next.js page searchParams and date-range filters —
// shared by the admin list pages so every page unwraps params and validates
// dates the same way (an invalid date must become undefined, never an
// Invalid Date handed to Prisma).

export type SearchParams = { [key: string]: string | string[] | undefined };

/** First value of a possibly-repeated query param. */
export function firstParam(sp: SearchParams, key: string): string | undefined {
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

function validDate(d: Date): Date | undefined {
  return Number.isNaN(d.getTime()) ? undefined : d;
}

/** Parse a `yyyy-mm-dd` filter value to the start of that day; undefined when missing/invalid. */
export function dayStart(raw: string | undefined): Date | undefined {
  return raw ? validDate(new Date(`${raw}T00:00:00.000`)) : undefined;
}

/** Parse a `yyyy-mm-dd` filter value to the (inclusive) end of that day; undefined when missing/invalid. */
export function dayEnd(raw: string | undefined): Date | undefined {
  return raw ? validDate(new Date(`${raw}T23:59:59.999`)) : undefined;
}
