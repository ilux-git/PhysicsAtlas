import { describe, expect, it } from 'vitest';
import { astEquals } from '../../domain/ast.ts';
import type { AstNode } from '../../domain/types.ts';
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
    ['b', 'q.velocity'],
    ['c', 'q.time'],
    ['s', 'q.displacement'],
    ['t', 'q.time'],
    ['A', 'q.work'],
    ['P', 'q.power'],
  ]),
};

const ID_TO_SYMBOL = new Map([
  ['q.force', 'F'],
  ['q.mass', 'm'],
  ['q.acceleration', 'a'],
  ['q.velocity', 'b'],
  ['q.time', 't'],
  ['q.displacement', 's'],
  ['q.work', 'A'],
  ['q.power', 'P'],
]);

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

  it('fixes the precedence matrix required by PROMPT-2', () => {
    expect(parseExpression('-a^2', OPTIONS)).toEqual({
      type: 'negate',
      arg: { type: 'power', base: { type: 'variable', quantityId: 'q.acceleration' }, exponent: 2 },
    });
    expect(parseExpression('(-a)^2', OPTIONS)).toEqual({
      type: 'power',
      base: { type: 'negate', arg: { type: 'variable', quantityId: 'q.acceleration' } },
      exponent: 2,
    });
    expect(parseExpression('a^-2', OPTIONS)).toMatchObject({ type: 'power', exponent: -2 });
    expect(parseExpression('a^2*b', OPTIONS).type).toBe('multiply');
    expect(parseExpression('2*m*a', OPTIONS)).toMatchObject({
      type: 'multiply',
      left: { type: 'multiply', left: { type: 'constant' } },
    });
    expect(parseExpression('m a', OPTIONS).type).toBe('multiply');

    const divided = parseExpression('a / b c', OPTIONS);
    expect(divided.type).toBe('divide');
    if (divided.type === 'divide') expect(divided.right.type).toBe('multiply');

    const mixed = parseExpression('m a / t', OPTIONS);
    expect(mixed.type).toBe('divide');
    if (mixed.type === 'divide') expect(mixed.left.type).toBe('multiply');

    const grouped = parseExpression('a/(b/c)', OPTIONS);
    expect(grouped.type).toBe('divide');
    if (grouped.type === 'divide') expect(grouped.right.type).toBe('divide');

    expect(parseExpression('sqrt(a^2)', OPTIONS).type).toBe('sqrt');
    expectCode(() => parseExpression('ma', OPTIONS), 'unknown-symbol');
    expect(() => parseExpression('a^2^3', OPTIONS)).toThrowError(FormulaParseError);
  });

  it('prints parentheses that preserve the AST', () => {
    const cases = ['-a^2', '(-a)^2', 'a^2*b', '(a+b)/c', 'a/(b/c)', 'a / b c', 'm a / t', 'sqrt(a^2)'];
    for (const source of cases) {
      const ast = parseExpression(source, OPTIONS);
      const printed = astToInfix(ast, ID_TO_SYMBOL);
      const reparsed = parseExpression(printed, OPTIONS);
      expect(astEquals(reparsed, ast), `${source} printed as ${printed}`).toBe(true);
    }
    expect(astToInfix(parseExpression('(a+b)/c', OPTIONS), ID_TO_SYMBOL)).toBe('(a + b) / t');
    expect(astToInfix(parseExpression('a/(b/c)', OPTIONS), ID_TO_SYMBOL)).toBe('a / (b / t)');
    expect(astToInfix(parseExpression('(-a)^2', OPTIONS), ID_TO_SYMBOL)).toBe('(−a)^2');
    expect(astToInfix(parseExpression('-a^2', OPTIONS), ID_TO_SYMBOL)).toBe('−a^2');
  });

  it('round-trips every seeded equation side through the printer', () => {
    const seeds: AstNode[] = [
      parseExpression('F', OPTIONS),
      parseExpression('m a', OPTIONS),
      parseExpression('A / t', OPTIONS),
      parseExpression('sqrt(a^2)', OPTIONS),
      parseExpression('m a / t', OPTIONS),
    ];
    for (const ast of seeds) {
      expect(astEquals(parseExpression(astToInfix(ast, ID_TO_SYMBOL), OPTIONS), ast)).toBe(true);
    }
  });
});