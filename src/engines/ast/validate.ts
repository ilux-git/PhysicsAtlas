import type { AstNode, Quantity } from '../../domain/types.ts';

export interface AstValidationContext {
  quantities: ReadonlyMap<string, Quantity>;
  maxDepth?: number;
}

export function validateAst(node: AstNode, context: AstValidationContext, depth = 1): string[] {
  const maxDepth = context.maxDepth ?? 16;
  const problems: string[] = [];
  if (depth > maxDepth) {
    problems.push(`Формула вложена глубже допустимых ${maxDepth} уровней.`);
    return problems;
  }
  switch (node.type) {
    case 'variable':
      if (!context.quantities.has(node.quantityId)) {
        problems.push(`Величина «${node.quantityId}» отсутствует в базе знаний.`);
      }
      break;
    case 'constant':
      if (!Number.isFinite(node.value)) {
        problems.push(`Константа «${node.name}» должна быть конечным числом.`);
      }
      break;
    case 'divide':
      if (node.right.type === 'constant' && node.right.value === 0) {
        problems.push('Деление на ноль в формуле.');
      }
      problems.push(...validateAst(node.left, context, depth + 1));
      problems.push(...validateAst(node.right, context, depth + 1));
      break;
    case 'add':
    case 'subtract':
    case 'multiply':
      problems.push(...validateAst(node.left, context, depth + 1));
      problems.push(...validateAst(node.right, context, depth + 1));
      break;
    case 'power':
      if (!Number.isInteger(node.exponent)) {
        problems.push('Показатель степени должен быть целым числом.');
      }
      problems.push(...validateAst(node.base, context, depth + 1));
      break;
    case 'sqrt':
    case 'negate':
      problems.push(...validateAst(node.arg, context, depth + 1));
      break;
  }
  return problems;
}

export function countOccurrences(node: AstNode, quantityId: string): number {
  switch (node.type) {
    case 'variable':
      return node.quantityId === quantityId ? 1 : 0;
    case 'constant':
      return 0;
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
      return (
        countOccurrences(node.left, quantityId) + countOccurrences(node.right, quantityId)
      );
    case 'power':
      return countOccurrences(node.base, quantityId);
    case 'sqrt':
    case 'negate':
      return countOccurrences(node.arg, quantityId);
  }
}

export function containsQuantity(node: AstNode, quantityId: string): boolean {
  return countOccurrences(node, quantityId) > 0;
}