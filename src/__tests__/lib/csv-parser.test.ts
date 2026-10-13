import { describe, it, expect } from 'vitest';
import { parseDate } from '@/lib/csv-parser';

describe('parseDate', () => {
  it('reads YYYY-MM-DD and ignores a time after it', () => {
    expect(parseDate('2026-01-15', 'auto')).toBe('2026-01-15');
    expect(parseDate('2026-01-15 09:30:00', 'YYYY-MM-DD')).toBe('2026-01-15');
  });

  it('reads YYYY/MM/DD and pads a single digit', () => {
    expect(parseDate('2026/1/5', 'auto')).toBe('2026-01-05');
  });

  it('reads DD/MM/YYYY', () => {
    expect(parseDate('15/01/2026', 'DD/MM/YYYY')).toBe('2026-01-15');
  });

  it('reads a slashed date as day first when left to work it out', () => {
    expect(parseDate('03/04/2026', 'auto')).toBe('2026-04-03');
  });

  it('reads MM/DD/YYYY when told to', () => {
    expect(parseDate('03/04/2026', 'MM/DD/YYYY')).toBe('2026-03-04');
  });

  it('reads DD-MM-YYYY', () => {
    expect(parseDate('15-01-2026', 'DD-MM-YYYY')).toBe('2026-01-15');
  });

  it('reads a two-digit year as this century', () => {
    expect(parseDate('15/01/26', 'DD/MM/YYYY')).toBe('2026-01-15');
  });

  it('keeps the day of a date written in words', () => {
    expect(parseDate('15 Jan 2026', 'auto')).toBe('2026-01-15');
  });

  it('rejects a day the month does not have', () => {
    expect(parseDate('31/02/2025', 'DD/MM/YYYY')).toBe('');
    expect(parseDate('2025-02-31', 'auto')).toBe('');
  });

  it('rejects a month that does not exist', () => {
    expect(parseDate('01/13/2025', 'DD/MM/YYYY')).toBe('');
  });

  it('rejects text that is not a date', () => {
    expect(parseDate('pending', 'auto')).toBe('');
    expect(parseDate('', 'auto')).toBe('');
  });

  it('does not fall back to another format when one is given', () => {
    expect(parseDate('15/01/2026', 'YYYY-MM-DD')).toBe('');
  });
});
