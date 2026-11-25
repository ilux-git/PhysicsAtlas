import { describe, expect, it } from 'vitest';
import type { AstNode } from '../../domain/types.ts';
import { EvaluationError, evaluate, evaluateEquation } from './evaluate.ts';
import { parseEquation, parseExpression, type ParseOptions } from './parse.ts';

const OPTIONS: ParseOptions = {
  symbols: new Map([
    ['F', 'q.force'],
    ['m', 'q.mass'],
    ['a', 'q.acceleration'],
    ['s', 'q.displacement'],
    ['t', 'q.time'],
  ]),
};

function expectCode(action: () => unknown, code: string): void {
  try {
    action();
  } catch (error) {
    expect(error).toBeInstanceOf(EvaluationError);
    expect((error as EvaluationError).code).toBe(code);
    return;
  }
  throw new Error(`Ожидалась ошибка ${code}`);
}

describe('AST evaluation', () => {
  it('computes SI values for a formula and an equation', () => {
    const node = parseExpression('m a', OPTIONS);
    expect(evaluate(node, new Map([['q.mass', 2], ['q.acceleration', 3]]))).toBe(6);

    const equation = parseEquation('F = m a', OPTIONS);
    const values = new Map([
      ['q.force', 6],
      ['q.mass', 2],
      ['q.acceleration', 3],
    ]);
    expect(evaluateEquation(equation.lhs, equation.rhs, values).difference).toBe(0);
  });

  it('reports a missing value instead of using zero', () => {
    expectCode(() => evaluate(parseExpression('m a', OPTIONS), new Map([['q.mass', 2]])), 'missing-value');
  });

  it('reports division by zero', () => {
    const divide: AstNode = {
      type: 'divide',
      left: { type: 'constant', name: '1', value: 1 },
      right: { type: 'constant', name: '0', value: 0 },
    };
    expectCode(() => evaluate(divide, new Map()), 'division-by-zero');
  });

  it('checks the domain of square roots and negative powers', () => {
    expectCode(() => evaluate(parseExpression('sqrt(0 - 1)', OPTIONS), new Map()), 'domain-error');
    const zeroPower: AstNode = { type: 'power', base: { type: 'constant', name: '0', value: 0 }, exponent: -1 };
    expectCode(() => evaluate(zeroPower, new Map()), 'domain-error');
  });

  it('reports overflow instead of Infinity', () => {
    const huge: AstNode = {
      type: 'multiply',
      left: { type: 'constant', name: '1e308', value: 1e308 },
      right: { type: 'constant', name: '10', value: 10 },
    };
    expectCode(() => evaluate(huge, new Map()), 'overflow');
  });
});