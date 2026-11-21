import type { AstNode, Equation, Quantity } from '../../domain/types.ts';
import { astToInfix } from './parse.ts';
import { countOccurrences, containsQuantity } from './validate.ts';

export interface SolvePrecondition {
  kind: 'nonzero' | 'nonnegative' | 'two-roots';
  text: string;
  quantityId?: string;
}

export type SolveResult =
  | { ok: true; targetId: string; ast: AstNode; preconditions: SolvePrecondition[] }
  | { ok: false; targetId: string; reason: string };

class SolveUnsupported extends Error {}

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

function sqrt(arg: AstNode): AstNode {
  return { type: 'sqrt', arg };
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
      throw new SolveUnsupported('Требуется деление на ноль; преобразование недопустимо.');
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
  pushPrecondition(context, {
    kind: 'nonnegative',
    text: `${describe(node, context)} ≥ 0`,
    ...(node.type === 'variable' ? { quantityId: node.quantityId } : {}),
  });
}

function solveNode(node: AstNode, other: AstNode, context: SolveContext): AstNode {
  switch (node.type) {
    case 'variable':
      if (node.quantityId === context.targetId) return other;
      throw new SolveUnsupported(
        `Величина «${node.quantityId}» не является целевой и не может быть выражена напрямую.`,
      );
    case 'constant':
      throw new SolveUnsupported('Формула не содержит целевую величину в инвертируемой позиции.');
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
        throw new SolveUnsupported('Целевая величина находится в основании степени, вычисление корня ограничено.');
      }
      if (node.exponent === 1) {
        return solveNode(node.base, other, context);
      }
      if (node.exponent === 2) {
        requireNonnegative(other, context);
        pushPrecondition(context, {
          kind: 'two-roots',
          text: 'Уравнение x² = c имеет два корня; в атласе выбирается неотрицательный корень.',
        });
        return solveNode(node.base, sqrt(other), context);
      }
      throw new SolveUnsupported(
        `Обратное преобразование степени ${node.exponent} не поддерживается (разрешены степени 1 и 2).`,
      );
    }

    case 'sqrt':
      requireNonnegative(other, context);
      return solveNode(node.arg, power(other, 2), context);
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
      reason: `Величина «${targetLabel}» не входит в уравнение «${equation.id}».`,
    };
  }
  if (totalOccurrences > 1) {
    return {
      ok: false,
      targetId,
      reason: `Величина «${targetLabel}» встречается в уравнении несколько раз; выразить её обратным преобразованием нельзя.`,
    };
  }

  const context: SolveContext = { targetId, symbols, preconditions: [] };
  try {
    const ast = containsQuantity(equation.lhsAst, targetId)
      ? solveNode(equation.lhsAst, equation.rhsAst, context)
      : solveNode(equation.rhsAst, equation.lhsAst, context);
    return { ok: true, targetId, ast, preconditions: context.preconditions };
  } catch (error) {
    if (error instanceof SolveUnsupported) {
      return { ok: false, targetId, reason: error.message };
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