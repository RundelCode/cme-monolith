import { Transform } from 'class-transformer';

export const ToNullIfEmpty = () =>
  Transform(({ value }) => (value === '' || value === undefined ? null : value));

export const ToBooleanOrNull = () =>
  Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return null;
    if (typeof value === 'boolean') return value;
    if (value === 'true' || value === '1') return true;
    if (value === 'false' || value === '0') return false;
    return value;
  });

export const ToNumberOrNull = () =>
  Transform(({ value }) => {
    if (value === '' || value === undefined || value === null) return null;
    const n = Number(value);
    return Number.isNaN(n) ? value : n;
  });
