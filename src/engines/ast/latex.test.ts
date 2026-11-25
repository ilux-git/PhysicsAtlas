import { describe, expect, it } from 'vitest';
import { FormulaParseError } from './parse.ts';
import { latexToExpression, parseDisplayEquation } from './latex.ts';

const symbols = new Map([
  ['F', 'q.force'],
  ['m', 'q.mass'],
  ['a', 'q.acceleration'],
  ['s', 'q.displacement'],
  ['t', 'q.time'],
  ['A', 'q.work'],
  ['P', 'q.power'],
  ['v', 'q.velocity'],
]);

describe('LaTeX display subset', () => {
  it('converts fractions, roots, delimiters and multiplication commands', () => {
    expect(latexToExpression('\\frac{A}{t}')).toBe('(A)/(t)');
    expect(latexToExpression('\\sqrt{a^2}')).toBe('sqrt(a^2)');
    expect(latexToExpression('\\left(m + a\\right)/t')).toBe('(m + a)/t');
    expect(latexToExpression('m \\cdot a')).toBe('m * a');
    expect(latexToExpression('m \\times a')).toBe('m * a');
    expect(latexToExpression('m a')).toBe('m a');
  });

  it('supports a braced integer exponent', () => {
    expect(latexToExpression('a^{2}')).toBe('a^2');
    expect(latexToExpression('a^{-2}')).toBe('a^-2');
  });

  it('parses a display equation into the same AST shape as the parser', () => {
    const parsed = parseDisplayEquation('v = \\frac{s}{t}', { symbols });
    expect(parsed.lhs).toEqual({ type: 'variable', quantityId: 'q.velocity' });
    expect(parsed.rhs.type).toBe('divide');
    if (parsed.rhs.type === 'divide') {
      expect(parsed.rhs.left).toEqual({ type: 'variable', quantityId: 'q.displacement' });
      expect(parsed.rhs.right).toEqual({ type: 'variable', quantityId: 'q.time' });
    }
  });

  it('rejects markup outside the supported subset', () => {
    for (const source of ['\\mathrm{F}', '\\text{сила}', '\\sin(a)', '$F$', '\\frac{A}{t']) {
      try {
        latexToExpression(source);
        throw new Error(`Ожидалась ошибка для «${source}»`);
      } catch (error) {
        expect(error).toBeInstanceOf(FormulaParseError);
        expect((error as FormulaParseError).code).toBe('unsupported-latex');
      }
    }
  });
});