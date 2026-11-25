import type { AstNode } from './types';

export function collectQuantityIds(node: AstNode, acc: Set<string> = new Set()): Set<string> {
  switch (node.type) {
    case 'variable':
      acc.add(node.quantityId);
      break;
    case 'constant':
      break;
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
      collectQuantityIds(node.left, acc);
      collectQuantityIds(node.right, acc);
      break;
    case 'power':
      collectQuantityIds(node.base, acc);
      break;
    case 'sqrt':
    case 'negate':
      collectQuantityIds(node.arg, acc);
      break;
  }
  return acc;
}

export function variableIdsOf(node: AstNode): string[] {
  return [...collectQuantityIds(node)];
}

export function walkAst(node: AstNode, visit: (n: AstNode) => void): void {
  visit(node);
  switch (node.type) {
    case 'variable':
    case 'constant':
      break;
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
      walkAst(node.left, visit);
      walkAst(node.right, visit);
      break;
    case 'power':
      walkAst(node.base, visit);
      break;
    case 'sqrt':
    case 'negate':
      walkAst(node.arg, visit);
      break;
  }
}

export function astEquals(a: AstNode, b: AstNode): boolean {
  if (a.type !== b.type) return false;
  switch (a.type) {
    case 'variable':
      return b.type === 'variable' && a.quantityId === b.quantityId;
    case 'constant':
      return b.type === 'constant' && a.value === b.value;
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
      return b.type === a.type && astEquals(a.left, b.left) && astEquals(a.right, b.right);
    case 'power':
      return b.type === 'power' && a.exponent === b.exponent && astEquals(a.base, b.base);
    case 'sqrt':
    case 'negate':
      return b.type === a.type && astEquals(a.arg, b.arg);
  }
}