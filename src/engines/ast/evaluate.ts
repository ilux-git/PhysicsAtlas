import type { AstNode } from '../../domain/types.ts';

export type EvaluationErrorCode =
  | 'missing-value'
  | 'division-by-zero'
  | 'domain-error'
  | 'overflow';

export class EvaluationError extends Error {
  readonly code: EvaluationErrorCode;

  constructor(code: EvaluationErrorCode, message: string) {
    super(message);
    this.name = 'EvaluationError';
    this.code = code;
  }
}

function ensureFinite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new EvaluationError('overflow', 'Результат вычисления не является конечным числом.');
  }
  return value;
}

export function evaluate(node: AstNode, values: ReadonlyMap<string, number>): number {
  switch (node.type) {
    case 'variable': {
      const value = values.get(node.quantityId);
      if (value === undefined) {
        throw new EvaluationError(
          'missing-value',
          `Не задано значение величины «${node.quantityId}».`,
        );
      }
      return ensureFinite(value);
    }
    case 'constant':
      return ensureFinite(node.value);
    case 'negate':
      return ensureFinite(-evaluate(node.arg, values));
    case 'add':
      return ensureFinite(evaluate(node.left, values) + evaluate(node.right, values));
    case 'subtract':
      return ensureFinite(evaluate(node.left, values) - evaluate(node.right, values));
    case 'multiply':
      return ensureFinite(evaluate(node.left, values) * evaluate(node.right, values));
    case 'divide': {
      const numerator = evaluate(node.left, values);
      const denominator = evaluate(node.right, values);
      if (denominator === 0) {
        throw new EvaluationError('division-by-zero', 'Деление на ноль.');
      }
      return ensureFinite(numerator / denominator);
    }
    case 'power': {
      const base = evaluate(node.base, values);
      if (base === 0 && node.exponent < 0) {
        throw new EvaluationError('domain-error', 'Ноль в отрицательной степени не определён.');
      }
      return ensureFinite(base ** node.exponent);
    }
    case 'sqrt': {
      const argument = evaluate(node.arg, values);
      if (argument < 0) {
        throw new EvaluationError(
          'domain-error',
          'Квадратный корень из отрицательного числа не определён в действительных числах.',
        );
      }
      return ensureFinite(Math.sqrt(argument));
    }
  }
}

export interface EquationEvaluation {
  lhs: number;
  rhs: number;
  difference: number;
}

export function evaluateEquation(
  lhs: AstNode,
  rhs: AstNode,
  values: ReadonlyMap<string, number>,
): EquationEvaluation {
  const left = evaluate(lhs, values);
  const right = evaluate(rhs, values);
  return { lhs: left, rhs: right, difference: left - right };
}