import { describe, expect, it } from 'vitest';
import {
  FormulaParseError,
  astToInfix,
  parseEquation,
  parseExpression,
  type ParseOptions,
} from './parse.ts';

const OPTIONS: ParseOptions = {
  symbols: new Map([
    ['F', 'q.force'],
    ['m', 'q.mass'],
    ['a', 'q.acceleration'],
    ['s', 'q.displacement'],
    ['t', 'q.time'],
    ['A', 'q.work'],
    ['P', 'q.power'],
  ]),
};

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(FormulaParseError);
    expect((error as FormulaParseError).code).toBe(code);
    return;
  }
  throw new Error(`Ожидалась ошибка ${code}`);
}

describe('formula parser', () => {
  it('parses implicit multiplication the way school formulas are written', () => {
    const node = parseExpression('m a', OPTIONS);
    expect(node.type).toBe('multiply');
  });

  it('respects operator precedence', () => {
    const sum = parseExpression('F + m a', OPTIONS);
    expect(sum.type).toBe('add');
    if (sum.type === 'add') {
      expect(sum.left.type).toBe('variable');
      expect(sum.right.type).toBe('multiply');
    }

    const power = parseExpression('m a ^ 2', OPTIONS);
    expect(power.type).toBe('multiply');
    if (power.type === 'multiply') {
      expect(power.right.type).toBe('power');
    }
  });

  it('parses parentheses, negation and sqrt', () => {
    const node = parseExpression('(m + F) / a', OPTIONS);
    expect(node.type).toBe('divide');
    if (node.type === 'divide') expect(node.left.type).toBe('add');

    expect(parseExpression('-F', OPTIONS)).toMatchObject({ type: 'negate' });
    expect(parseExpression('sqrt(a)', OPTIONS).type).toBe('sqrt');
  });

  it('normalizes unicode minus and multiplication signs', () => {
    const equation = parseEquation('F = m·a', OPTIONS);
    expect(equation.lhs).toEqual({ type: 'variable', quantityId: 'q.force' });
    expect(equation.rhs.type).toBe('multiply');
    expect(astToInfix(parseExpression('m − a', OPTIONS))).toContain('−');
  });

  it('parses equations with exactly one equals sign', () => {
    const equation = parseEquation('F = m a', OPTIONS);
    expect(equation.rhs.type).toBe('multiply');
    expectCode(() => parseEquation('F = m = a', OPTIONS), 'invalid-equation');
  });

  it('rejects unknown symbols instead of guessing', () => {
    expectCode(() => parseExpression('x + 1', OPTIONS), 'unknown-symbol');
  });

  it('rejects code-like input', () => {
    expect(() => parseExpression('process.exit(0)', OPTIONS)).toThrowError(FormulaParseError);
    expect(() => parseExpression('alert(1)', OPTIONS)).toThrowError(FormulaParseError);
  });

  it('rejects unsupported functions and non-integer exponents', () => {
    expectCode(() => parseExpression('sin(a)', OPTIONS), 'unknown-function');
    expectCode(() => parseExpression('m^1.5', OPTIONS), 'invalid-exponent');
  });

  it('rejects malformed formulas', () => {
    expectCode(() => parseExpression('', OPTIONS), 'empty-expression');
    expectCode(() => parseExpression('m a)', OPTIONS), 'unexpected-token');
    expectCode(() => parseExpression('(m + a', OPTIONS), 'missing-parenthesis');
    expectCode(() => parseExpression('m & a', OPTIONS), 'unexpected-character');
  });
});