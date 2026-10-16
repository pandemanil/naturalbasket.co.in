import { HttpError } from './http';

export function str(v: unknown, field: string, opts: { min?: number; max: number; optional?: boolean }): string {
  if (v === undefined || v === null || v === '') {
    if (opts.optional) return '';
    throw new HttpError(422, `${field} is required.`, { [field]: 'Required' });
  }
  if (typeof v !== 'string') throw new HttpError(422, `${field} must be text.`, { [field]: 'Must be text' });
  const t = v.trim();
  if (t.length === 0 && opts.optional) return '';
  if (opts.min !== undefined && t.length < opts.min) {
    throw new HttpError(422, `${field} is too short.`, { [field]: `At least ${opts.min} characters` });
  }
  if (t.length > opts.max) {
    throw new HttpError(422, `${field} is too long.`, { [field]: `At most ${opts.max} characters` });
  }
  return t;
}

export function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isSafeInteger(v)) {
    throw new HttpError(422, `${field} must be a whole number.`, { [field]: 'Whole number required' });
  }
  if (v < min || v > max) {
    throw new HttpError(422, `${field} must be between ${min} and ${max}.`, { [field]: `Range ${min}–${max}` });
  }
  return v;
}

export function bool(v: unknown, field: string): number {
  if (v === undefined) return 0;
  if (typeof v !== 'boolean') throw new HttpError(422, `${field} must be true or false.`);
  return v ? 1 : 0;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'product';
}

export function parseId(raw: string | undefined, field = 'id'): number {
  const n = Number(raw);
  if (!Number.isSafeInteger(n) || n <= 0) throw new HttpError(400, `Invalid ${field}.`);
  return n;
}
