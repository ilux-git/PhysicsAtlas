import type { AstNode } from '../domain/types.ts';
import { formatNumber } from './labels.ts';

function astLines(node: AstNode, symbolOf: (id: string) => string, depth = 0): string[] {
  const indent = '  '.repeat(depth);
  switch (node.type) {
    case 'variable':
      return [`${indent}variable(${symbolOf(node.quantityId)})`];
    case 'constant':
      return [`${indent}constant(${formatNumber(node.value)})`];
    case 'negate':
      return [`${indent}negate`, ...astLines(node.arg, symbolOf, depth + 1)];
    case 'sqrt':
      return [`${indent}sqrt`, ...astLines(node.arg, symbolOf, depth + 1)];
    case 'power':
      return [`${indent}power(^${node.exponent})`, ...astLines(node.base, symbolOf, depth + 1)];
    case 'add':
    case 'subtract':
    case 'multiply':
    case 'divide':
      return [
        `${indent}${node.type}`,
        ...astLines(node.left, symbolOf, depth + 1),
        ...astLines(node.right, symbolOf, depth + 1),
      ];
  }
}

export function AstTree({ node, symbolOf }: { node: AstNode; symbolOf: (id: string) => string }) {
  return <pre className="ast-tree">{astLines(node, symbolOf).join('\n')}</pre>;
}

export function AstPair({
  lhs,
  rhs,
  symbolOf,
}: {
  lhs: AstNode;
  rhs: AstNode;
  symbolOf: (id: string) => string;
}) {
  return (
    <>
      <AstTree node={lhs} symbolOf={symbolOf} />
      <p className="ast-equals">=</p>
      <AstTree node={rhs} symbolOf={symbolOf} />
    </>
  );
}