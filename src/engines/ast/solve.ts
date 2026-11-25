import type { AstNode, Equation, Quantity } from '../../domain/types.ts';
import { astToInfix } from './parse.ts';
import { countOccurrences, containsQuantity } from './validate.ts';

export interface SolvePrecondition {
  kind: 'nonzero' | 'nonnegative';
  text: string;
  quantityId?: string;
}

export type SolveFailureCode =
  | 'target-absent'
  | 'target-multiple'
  | 'multiple-solutions'
  | 'no-real-solutions'
  | 'unsupported-power'
  | 'domain-violation'
  | 'unsupported-operation';

export type SolveResult =
  | { ok: true; targetId: string; ast: AstNode; preconditions: SolvePrecondition[] }
  | { ok: false; targetId: string; code: SolveFailureCode; reason: string };

class SolveFailure extends Error {
  readonly code: SolveFailureCode;

  constructor(code: SolveFailureCode, message: string) {
    super(message);
    this.code = code;
  }
}

function variable(quantityId: string): AstNode {
  return { type: 'variable', quantityId };
}

function constant(value: number): AstNode {
  return { type: 'constant', name: String(value), value };
}

function negate(arg: AstNode): AstNode {
  return { type: 'negate', arg };
}

function binary(
  operator: 'add' | 'subtract' | 'multiply' | 'divide',
  left: AstNode,
  right: AstNode,
): AstNode {
  return { type: operator, left, right };
}

function power(base: AstNode, exponent: number): AstNode {
  return { type: 'power', base, exponent };
}

interface SolveContext {
  targetId: string;
  symbols: ReadonlyMap<string, string>;
  preconditions: SolvePrecondition[];
}

function describe(node: AstNode, context: SolveContext): string {
  return astToInfix(node, context.symbols);
}

function pushPrecondition(context: SolveContext, precondition: SolvePrecondition): void {
  if (!context.preconditions.some((item) => item.text === precondition.text)) {
    context.preconditions.push(precondition);
  }
}

function requireNonzero(node: AstNode, context: SolveContext): void {
  if (node.type === 'constant') {
    if (node.value === 0) {
      throw new SolveFailure('domain-violation', 'Деление на литеральный ноль недопустимо в области определения формулы.');
    }
    return;
  }
  pushPrecondition(context, {
    kind: 'nonzero',
    text: `${describe(node, context)} ≠ 0`,
    ...(node.type === 'variable' ? { quantityId: node.quantityId } : {}),
  });
}

function requireNonnegative(node: AstNode, context: SolveContext): void {
  if (node.type === 'constant' && node.value < 0) {
    throw new SolveFailure(
      'domain-violation',
      `Подкоренное выражение ${describe(node, context)} отрицательно; действительных значений нет.`,
    );
  }
  if (node.type === 'constant') return;
  pushPrecondition(context, {
    kind: 'nonnegative',
    text: `${describe(node, context)} ≥ 0`,
    ...(node.type === 'variable' ? { quantityId: node.quantityId } : {}),
  });
}

function collectDomainPreconditions(node: AstNode, context: SolveContext): void {
  switch (node.type) {
    case 'variable':
    case 'constant':
      return;
    case 'negate':
      collectDomainPreconditions(node.arg, context);
      return;
    case 'sqrt':
      requireNonnegative(node.arg, context);
      collectDomainPreconditions(node.arg, context);
      return;
    case 'power':
      if (node.exponent < 0) requireNonzero(node.base, context);
      collectDomainPreconditions(node.base, context);
      return;
    case 'divide':
      requireNonzero(node.right, context);
      collectDomainPreconditions(node.left, context);
      collectDomainPreconditions(node.right, context);
      return;
    case 'add':
    case 'subtract':
    case 'multiply':
      collectDomainPreconditions(node.left, context);
      collectDomainPreconditions(node.right, context);
  }
}

function solveNode(node: AstNode, other: AstNode, context: SolveContext): AstNode {
  switch (node.type) {
    case 'variable':
      if (node.quantityId === context.targetId) return other;
      throw new SolveFailure(
        'unsupported-operation',
        `Величина «${node.quantityId}» не является целевой и не может быть выражена напрямую.`,
      );
    case 'constant':
      throw new SolveFailure(
        'unsupported-operation',
        'Формула не содержит целевую величину в инвертируемой позиции.',
      );
    case 'negate':
      return solveNode(node.arg, negate(other), context);

    case 'add':
      if (containsQuantity(node.left, context.targetId)) {
        return solveNode(node.left, binary('subtract', other, node.right), context);
      }
      return solveNode(node.right, binary('subtract', other, node.left), context);

    case 'subtract':
      if (containsQuantity(node.left, context.targetId)) {
        return solveNode(node.left, binary('add', other, node.right), context);
      }
      return solveNode(node.right, binary('subtract', node.left, other), context);

    case 'multiply':
      if (containsQuantity(node.left, context.targetId)) {
        requireNonzero(node.right, context);
        return solveNode(node.left, binary('divide', other, node.right), context);
      }
      requireNonzero(node.left, context);
      return solveNode(node.right, binary('divide', other, node.left), context);

    case 'divide':
      requireNonzero(node.right, context);
      if (containsQuantity(node.left, context.targetId)) {
        return solveNode(node.left, binary('multiply', other, node.right), context);
      }
      requireNonzero(other, context);
      return solveNode(node.right, binary('divide', node.left, other), context);

    case 'power': {
      if (!containsQuantity(node.base, context.targetId)) {
        throw new SolveFailure(
          'unsupported-operation',
          'Целевая величина не находится в основании степени.',
        );
      }
      if (node.exponent === 1) {
        return solveNode(node.base, other, context);
      }
      if (node.exponent === 2) {
        if (other.type === 'constant' && other.value < 0) {
          throw new SolveFailure(
            'no-real-solutions',
            `Уравнение ${describe(node, context)} = ${describe(other, context)} не имеет действительных решений.`,
          );
        }
        throw new SolveFailure(
          'multiple-solutions',
          `Уравнение ${describe(node, context)} = ${describe(other, context)} имеет два корня ±√(${describe(other, context)}). Модель не представляет множество решений и не выбирает один корень произвольно.`,
        );
      }
      throw new SolveFailure(
        'unsupported-power',
        `Обратное преобразование степени ${node.exponent} не поддерживается; модель решает только степень 1 и главный квадратный корень.`,
      );
    }

    case 'sqrt': {
      if (other.type === 'constant' && other.value < 0) {
        throw new SolveFailure(
          'no-real-solutions',
          `Квадратный корень равен отрицательному числу ${describe(other, context)}; действительных решений нет.`,
        );
      }
      requireNonnegative(other, context);
      return solveNode(node.arg, power(other, 2), context);
    }
  }
}

export function solveFor(
  equation: Equation,
  targetId: string,
  quantities: ReadonlyMap<string, Quantity>,
): SolveResult {
  const symbols = new Map<string, string>();
  for (const quantity of quantities.values()) symbols.set(quantity.id, quantity.symbol);

  const target = quantities.get(targetId);
  const targetLabel = target ? target.symbol : targetId;

  const totalOccurrences =
    countOccurrences(equation.lhsAst, targetId) + countOccurrences(equation.rhsAst, targetId);
  if (totalOccurrences === 0) {
    return {
      ok: false,
      targetId,
      code: 'target-absent',
      reason: `Величина «${targetLabel}» не входит в уравнение «${equation.id}».`,
    };
  }
  if (totalOccurrences > 1) {
    return {
      ok: false,
      targetId,
      code: 'target-multiple',
      reason: `Величина «${targetLabel}» встречается в уравнении несколько раз; выразить её обратным преобразованием нельзя.`,
    };
  }

  const context: SolveContext = { targetId, symbols, preconditions: [] };
  try {
    collectDomainPreconditions(equation.lhsAst, context);
    collectDomainPreconditions(equation.rhsAst, context);
    const ast = containsQuantity(equation.lhsAst, targetId)
      ? solveNode(equation.lhsAst, equation.rhsAst, context)
      : solveNode(equation.rhsAst, equation.lhsAst, context);
    return { ok: true, targetId, ast, preconditions: context.preconditions };
  } catch (error) {
    if (error instanceof SolveFailure) {
      return { ok: false, targetId, code: error.code, reason: error.message };
    }
    throw error;
  }
}

export function solvedSideVariable(equation: Equation): string | null {
  if (equation.lhsAst.type === 'variable') return equation.lhsAst.quantityId;
  if (equation.rhsAst.type === 'variable') return equation.rhsAst.quantityId;
  return null;
}

export { constant as constantNode, variable as variableNode };