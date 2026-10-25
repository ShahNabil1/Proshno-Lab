import { expect, it } from 'vitest';
import { paperSetCode } from './paperSetCode';
it('advances set codes without repeating after the alphabet ends', () => {
  expect(paperSetCode(0)).toBe('\u0995');
  expect(paperSetCode(1)).toBe('\u0996');
  expect(paperSetCode(2)).toBe('\u0997');
  expect(paperSetCode(0, true)).toBe('A');
  expect(paperSetCode(1, true)).toBe('B');
  expect(paperSetCode(26, true)).toBe('AA');
  expect(new Set(Array.from({ length: 100 }, (_, i) => paperSetCode(i))).size).toBe(100);
});
