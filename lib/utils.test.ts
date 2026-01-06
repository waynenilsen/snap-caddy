import { describe, it, expect } from 'bun:test';
import { cn } from './utils';

describe('cn utility function', () => {
  describe('empty and basic inputs', () => {
    it('should return empty string for no arguments', () => {
      expect(cn()).toBe('');
    });

    it('should return empty string for empty string', () => {
      expect(cn('')).toBe('');
    });

    it('should return single class name', () => {
      expect(cn('foo')).toBe('foo');
    });

    it('should handle multiple class names as separate arguments', () => {
      expect(cn('foo', 'bar')).toBe('foo bar');
    });

    it('should handle multiple class names in a single string', () => {
      expect(cn('foo bar baz')).toBe('foo bar baz');
    });
  });

  describe('conditional classes', () => {
    it('should handle object with boolean values', () => {
      expect(cn({ foo: true, bar: false })).toBe('foo');
    });

    it('should handle multiple objects', () => {
      expect(cn({ foo: true }, { bar: true })).toBe('foo bar');
    });

    it('should handle mixed strings and objects', () => {
      expect(cn('base', { active: true, disabled: false })).toBe('base active');
    });

    it('should handle all false conditions', () => {
      expect(cn({ foo: false, bar: false })).toBe('');
    });
  });

  describe('array inputs', () => {
    it('should handle array of class names', () => {
      expect(cn(['foo', 'bar'])).toBe('foo bar');
    });

    it('should handle nested arrays', () => {
      expect(cn(['foo', ['bar', 'baz']])).toBe('foo bar baz');
    });

    it('should handle array with conditional objects', () => {
      expect(cn(['foo', { bar: true, baz: false }])).toBe('foo bar');
    });

    it('should handle mixed arrays and strings', () => {
      expect(cn('base', ['foo', 'bar'], 'end')).toBe('base foo bar end');
    });
  });

  describe('null and undefined handling', () => {
    it('should handle null values', () => {
      expect(cn('foo', null, 'bar')).toBe('foo bar');
    });

    it('should handle undefined values', () => {
      expect(cn('foo', undefined, 'bar')).toBe('foo bar');
    });

    it('should handle mixed null, undefined, and strings', () => {
      expect(cn(null, 'foo', undefined, 'bar', null)).toBe('foo bar');
    });

    it('should handle only null and undefined', () => {
      expect(cn(null, undefined)).toBe('');
    });
  });

  describe('Tailwind CSS merge behavior', () => {
    it('should merge conflicting padding classes', () => {
      expect(cn('p-2', 'p-4')).toBe('p-4');
    });

    it('should merge conflicting margin classes', () => {
      expect(cn('m-2', 'm-4')).toBe('m-4');
    });

    it('should merge conflicting text size classes', () => {
      expect(cn('text-sm', 'text-lg')).toBe('text-lg');
    });

    it('should merge conflicting background color classes', () => {
      expect(cn('bg-red-500', 'bg-blue-500')).toBe('bg-blue-500');
    });

    it('should keep non-conflicting classes', () => {
      expect(cn('p-2', 'bg-blue-500', 'text-white')).toBe('p-2 bg-blue-500 text-white');
    });

    it('should handle directional padding conflicts', () => {
      expect(cn('px-2', 'px-4')).toBe('px-4');
      expect(cn('py-2', 'py-4')).toBe('py-4');
    });

    it('should handle specific side padding over general padding', () => {
      expect(cn('p-4', 'pt-2')).toBe('p-4 pt-2');
    });

    it('should merge complex conflicting utilities', () => {
      expect(cn('rounded-md', 'rounded-lg')).toBe('rounded-lg');
    });

    it('should handle hover state conflicts', () => {
      expect(cn('hover:bg-red-500', 'hover:bg-blue-500')).toBe('hover:bg-blue-500');
    });

    it('should keep different states separate', () => {
      expect(cn('bg-red-500', 'hover:bg-blue-500')).toBe('bg-red-500 hover:bg-blue-500');
    });
  });

  describe('complex real-world scenarios', () => {
    it('should handle button variants with conditions', () => {
      const isActive = true;
      const isDisabled = false;
      expect(
        cn(
          'px-4 py-2 rounded-md',
          isActive && 'bg-blue-500 text-white',
          isDisabled && 'opacity-50 cursor-not-allowed'
        )
      ).toBe('px-4 py-2 rounded-md bg-blue-500 text-white');
    });

    it('should handle conditional class overrides', () => {
      const variant = 'primary';
      expect(
        cn(
          'px-4 py-2',
          variant === 'primary' && 'bg-blue-500',
          variant === 'secondary' && 'bg-gray-500'
        )
      ).toBe('px-4 py-2 bg-blue-500');
    });

    it('should merge classes from multiple sources with conflicts', () => {
      const baseClasses = 'p-2 bg-gray-100 text-black';
      const variantClasses = 'p-4 bg-blue-500';
      const stateClasses = { 'text-white': true, 'font-bold': false };

      // Later classes override earlier conflicting ones
      expect(cn(baseClasses, variantClasses, stateClasses)).toBe('p-4 bg-blue-500 text-white');
    });

    it('should handle empty arrays and falsy values', () => {
      expect(cn('foo', [], false, 'bar', '', 0, 'baz')).toBe('foo bar baz');
    });

    it('should preserve non-conflicting duplicate classes', () => {
      // clsx preserves duplicates, but they appear in the order provided
      expect(cn('foo', 'bar', 'foo')).toBe('foo bar foo');
    });

    it('should handle responsive classes without conflicts', () => {
      expect(cn('p-2', 'md:p-4', 'lg:p-6')).toBe('p-2 md:p-4 lg:p-6');
    });

    it('should handle arbitrary values', () => {
      expect(cn('p-[10px]', 'p-[20px]')).toBe('p-[20px]');
    });
  });

  describe('whitespace handling', () => {
    it('should handle extra whitespace in strings', () => {
      expect(cn('  foo   bar  ')).toBe('foo bar');
    });

    it('should normalize multiple spaces', () => {
      expect(cn('foo    bar     baz')).toBe('foo bar baz');
    });

    it('should handle tabs and newlines', () => {
      expect(cn('foo\tbar\nbaz')).toBe('foo bar baz');
    });
  });
});
