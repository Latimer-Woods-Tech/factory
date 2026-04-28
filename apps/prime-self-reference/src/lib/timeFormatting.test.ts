/**
 * Tests for timeFormatting utilities
 * 
 * Tests conversion between 12-hour AM/PM and 24-hour ISO 8601 formats,
 * including edge cases (midnight, noon, etc.)
 */

import { describe, it, expect } from 'vitest';
import {
  formatTo12Hour,
  convertTo24Hour,
  isValidTime,
} from '../lib/timeFormatting';

describe('timeFormatting', () => {
  describe('formatTo12Hour', () => {
    it('converts morning times (1-11 AM)', () => {
      expect(formatTo12Hour('01:00')).toEqual([1, 0, 'AM']);
      expect(formatTo12Hour('06:30')).toEqual([6, 30, 'AM']);
      expect(formatTo12Hour('11:59')).toEqual([11, 59, 'AM']);
    });

    it('converts noon (12 PM)', () => {
      expect(formatTo12Hour('12:00')).toEqual([12, 0, 'PM']);
      expect(formatTo12Hour('12:30')).toEqual([12, 30, 'PM']);
      expect(formatTo12Hour('12:59')).toEqual([12, 59, 'PM']);
    });

    it('converts afternoon/evening times (1-11 PM)', () => {
      expect(formatTo12Hour('13:00')).toEqual([1, 0, 'PM']);
      expect(formatTo12Hour('15:45')).toEqual([3, 45, 'PM']);
      expect(formatTo12Hour('23:59')).toEqual([11, 59, 'PM']);
    });

    it('converts midnight (12 AM)', () => {
      expect(formatTo12Hour('00:00')).toEqual([12, 0, 'AM']);
      expect(formatTo12Hour('00:15')).toEqual([12, 15, 'AM']);
      expect(formatTo12Hour('00:59')).toEqual([12, 59, 'AM']);
    });

    it('preserves minutes correctly', () => {
      expect(formatTo12Hour('09:00')[1]).toBe(0);
      expect(formatTo12Hour('09:01')[1]).toBe(1);
      expect(formatTo12Hour('09:30')[1]).toBe(30);
      expect(formatTo12Hour('09:59')[1]).toBe(59);
    });
  });

  describe('convertTo24Hour', () => {
    it('converts morning times (1-11 AM)', () => {
      expect(convertTo24Hour(1, 0, 'AM')).toBe('01:00');
      expect(convertTo24Hour(6, 30, 'AM')).toBe('06:30');
      expect(convertTo24Hour(11, 59, 'AM')).toBe('11:59');
    });

    it('converts noon (12 PM)', () => {
      expect(convertTo24Hour(12, 0, 'PM')).toBe('12:00');
      expect(convertTo24Hour(12, 30, 'PM')).toBe('12:30');
      expect(convertTo24Hour(12, 59, 'PM')).toBe('12:59');
    });

    it('converts afternoon/evening times (1-11 PM)', () => {
      expect(convertTo24Hour(1, 0, 'PM')).toBe('13:00');
      expect(convertTo24Hour(3, 45, 'PM')).toBe('15:45');
      expect(convertTo24Hour(11, 59, 'PM')).toBe('23:59');
    });

    it('converts midnight (12 AM)', () => {
      expect(convertTo24Hour(12, 0, 'AM')).toBe('00:00');
      expect(convertTo24Hour(12, 15, 'AM')).toBe('00:15');
      expect(convertTo24Hour(12, 59, 'AM')).toBe('00:59');
    });

    it('formats with leading zeros', () => {
      expect(convertTo24Hour(1, 5, 'AM')).toBe('01:05');
      expect(convertTo24Hour(2, 1, 'PM')).toBe('14:01');
    });

    it('throws on invalid hours', () => {
      expect(() => convertTo24Hour(0, 30, 'AM')).toThrow('Invalid hours');
      expect(() => convertTo24Hour(13, 30, 'AM')).toThrow('Invalid hours');
      expect(() => convertTo24Hour(-1, 30, 'AM')).toThrow('Invalid hours');
    });

    it('throws on invalid minutes', () => {
      expect(() => convertTo24Hour(6, -1, 'AM')).toThrow('Invalid minutes');
      expect(() => convertTo24Hour(6, 60, 'AM')).toThrow('Invalid minutes');
      expect(() => convertTo24Hour(6, 100, 'AM')).toThrow('Invalid minutes');
    });

    it('throws on invalid period', () => {
      expect(() => convertTo24Hour(6, 30, 'ap' as any)).toThrow(
        'Invalid period'
      );
      expect(() => convertTo24Hour(6, 30, '' as any)).toThrow(
        'Invalid period'
      );
    });
  });

  describe('isValidTime', () => {
    it('validates valid 24-hour times', () => {
      expect(isValidTime('00:00')).toBe(true);
      expect(isValidTime('12:00')).toBe(true);
      expect(isValidTime('23:59')).toBe(true);
      expect(isValidTime('15:45')).toBe(true);
    });

    it('rejects invalid hours', () => {
      expect(isValidTime('24:00')).toBe(false);
      expect(isValidTime('-1:00')).toBe(false);
    });

    it('rejects invalid minutes', () => {
      expect(isValidTime('12:60')).toBe(false);
      expect(isValidTime('12:-1')).toBe(false);
    });

    it('rejects malformed times', () => {
      expect(isValidTime('12')).toBe(false);
      expect(isValidTime('12:00:00')).toBe(false);
      expect(isValidTime('')).toBe(false);
      expect(isValidTime('abc')).toBe(false);
    });
  });

  describe('round-trip conversions', () => {
    it('converts 12-hour → 24-hour → 12-hour correctly', () => {
      const testCases: Array<[number, number, 'AM' | 'PM']> = [
        [1, 0, 'AM'],
        [6, 30, 'AM'],
        [11, 59, 'AM'],
        [12, 0, 'PM'],
        [3, 45, 'PM'],
        [11, 59, 'PM'],
        [12, 0, 'AM'],
      ];

      for (const [hours12, minutes, period] of testCases) {
        const iso = convertTo24Hour(hours12, minutes, period);
        const [h, m, p] = formatTo12Hour(iso);
        expect(h).toBe(hours12);
        expect(m).toBe(minutes);
        expect(p).toBe(period);
      }
    });

    it('converts 24-hour → 12-hour → 24-hour correctly', () => {
      const testCases = [
        '00:00',
        '01:30',
        '06:45',
        '11:59',
        '12:00',
        '13:00',
        '15:45',
        '23:59',
      ];

      for (const iso of testCases) {
        const [h, m, p] = formatTo12Hour(iso);
        const converted = convertTo24Hour(h, m, p);
        expect(converted).toBe(iso);
      }
    });
  });
});
