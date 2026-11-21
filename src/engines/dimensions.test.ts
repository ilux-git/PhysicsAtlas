import { describe, expect, it } from 'vitest';
import type { DimensionVector } from '../domain/types.ts';
import { loadKnowledgeBase } from '../knowledge/index.ts';
import { parseExpression, type ParseOptions } from './ast/parse.ts';
import {
  checkEquationDimensions,
  dimensionOf,
  formatDimension,
  quantityDimensionsFrom,
} from './dimensions.ts';

const SYMBOLS = new Map([
  ['F', 'q.force'],
  ['m', 'q.mass'],
  ['a', 'q.acceleration'],
  ['s', 'q.displacement'],
  ['t', 'q.time'],
  ['A', 'q.work'],
  ['P', 'q.power'],
]);

function options(): ParseOptions {
  return { symbols: SYMBOLS };
}

function quantityDimensions(): ReadonlyMap<string, DimensionVector> {
  const { kb } = loadKnowledgeBase();
  return quantityDimensionsFrom(kb!);
}

function dims(source: string): DimensionVector {
  return dimensionOf(parseExpression(source, options()), quantityDimensions());
}

describe('dimension algebra', () => {
  it('formats base exponents with superscripts', () => {
    expect(formatDimension({ L: 1, M: 1, T: -2, I: 0, Th: 0, N: 0, J: 0 })).toBe('L·M·T⁻²');
    expect(formatDimension({ L: 0, M: 0, T: 0, I: 0, Th: 0, N: 0, J: 0 })).toContain('безразмерная');
  });

  it('computes the dimension of F = m a', () => {
    expect(formatDimension(dims('m a'))).toBe('L·M·T⁻²');
  });

  it('handles products, quotients, powers and square roots', () => {
    expect(formatDimension(dims('F t'))).toBe('L·M·T⁻¹');
    expect(formatDimension(dims('A / t'))).toBe('L²·M·T⁻³');
    expect(formatDimension(dims('a ^ 2'))).toBe('L²·T⁻⁴');
    expect(formatDimension(dims('sqrt(a ^ 2)'))).toBe('L·T⁻²');
  });

  it('rejects adding incompatible dimensions', () => {
    expect(() => dims('s + t')).toThrowError(/Нельзя складывать/);
  });

  it('rejects a square root with odd exponents', () => {
    expect(() => dims('sqrt(s)')).toThrowError(/дробный показатель/);
  });
});

describe('equation dimension checks', () => {
  it('accepts F = ma and F = 2ma', () => {
    const left = parseExpression('F', options());
    const right = parseExpression('m a', options());
    const scaled = parseExpression('2 m a', options());
    const dimensions = quantityDimensions();
    expect(dimensionOf(left, dimensions)).toEqual(dimensionOf(right, dimensions));
    expect(dimensionOf(left, dimensions)).toEqual(dimensionOf(scaled, dimensions));
  });

  it('detects a dimensionally inconsistent equation', () => {
    const dimensions = quantityDimensions();
    const check = checkEquationDimensions(
      parseExpression('F', options()),
      parseExpression('m s', options()),
      dimensions,
    );
    expect(check.ok).toBe(false);
    expect(check.message).toContain('L·M·T⁻²');
  });

  it('accepts the seeded equations', () => {
    const { kb } = loadKnowledgeBase();
    const dimensions = quantityDimensionsFrom(kb!);
    for (const equation of kb!.equations) {
      const check = checkEquationDimensions(equation.lhsAst, equation.rhsAst, dimensions);
      expect(check.ok, `${equation.id}: ${check.message}`).toBe(true);
    }
  });
});