import { collectQuantityIds } from '../domain/ast.ts';
import type { Edge, EdgeKind, KnowledgeInput, Unit } from '../domain/types.ts';

export function deriveEdges(input: KnowledgeInput): Edge[] {
  const edges: Edge[] = [];
  const seen = new Set<string>();

  const add = (
    kind: EdgeKind,
    from: string,
    to: string,
    origin: Edge['origin'] = 'derived',
  ): void => {
    const id = `${kind}:${from}->${to}`;
    if (seen.has(id)) return;
    seen.add(id);
    edges.push({ id, kind, from, to, origin });
  };

  for (const equation of input.equations) {
    for (const quantityId of collectQuantityIds(equation.lhsAst)) {
      add('appears_in', quantityId, equation.id);
    }
    for (const quantityId of collectQuantityIds(equation.rhsAst)) {
      add('appears_in', quantityId, equation.id);
    }
    for (const lawId of equation.lawRefs) {
      add('expresses', equation.id, lawId);
    }
    for (const conditionId of equation.conditionRefs) {
      add('requires_condition', equation.id, conditionId);
    }
  }

  for (const quantity of input.quantities) {
    add('has_dimension', quantity.id, quantity.dimensionId);
    for (const unitId of quantity.unitIds) {
      add('has_unit', quantity.id, unitId);
    }
  }

  for (const law of input.laws) {
    for (const conditionId of law.conditionRefs) {
      add('requires_condition', law.id, conditionId);
    }
  }

  for (const derivation of input.derivations) {
    add('has_derivation', derivation.sourceEquationId, derivation.id);
    add('produces', derivation.id, derivation.targetEquationId);
    add('derived_from', derivation.targetEquationId, derivation.sourceEquationId);
  }

  const groups = new Map<string, Unit[]>();
  for (const unit of input.units) {
    const group = groups.get(unit.conversionGroup) ?? [];
    group.push(unit);
    groups.set(unit.conversionGroup, group);
  }
  for (const group of groups.values()) {
    for (const from of group) {
      for (const to of group) {
        if (from.id !== to.id && from.dimensionId === to.dimensionId) {
          add('equivalent_unit', from.id, to.id);
        }
      }
    }
  }

  return edges.sort((a, b) =>
    a.kind === b.kind
      ? a.from === b.from
        ? a.to.localeCompare(b.to)
        : a.from.localeCompare(b.from)
      : a.kind.localeCompare(b.kind),
  );
}