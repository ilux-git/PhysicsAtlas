import { describe, expect, it } from 'vitest';
import { EDGE_REGISTRY } from '../domain/edges.ts';
import type { Edge, EdgeKind } from '../domain/types.ts';
import { makeValidInput } from '../test/fixtures.ts';
import { buildKnowledgeBase } from './index.ts';
import { deriveEdges } from './derive.ts';
import { validateEdges } from './validate.ts';

describe('derived graph edges', () => {
  const edges = deriveEdges(makeValidInput());
  const has = (kind: string, from: string, to: string): boolean =>
    edges.some((edge) => edge.kind === kind && edge.from === from && edge.to === to);

  it('derives appears_in from equation variables', () => {
    expect(has('appears_in', 'q.speed', 'eq.speed')).toBe(true);
    expect(has('appears_in', 'q.distance', 'eq.speed')).toBe(true);
    expect(has('appears_in', 'q.time', 'eq.speed')).toBe(true);
  });

  it('derives expresses from law references', () => {
    expect(has('expresses', 'eq.speed', 'law.motion')).toBe(true);
  });

  it('derives dimensional and unit edges from quantity fields', () => {
    expect(has('has_dimension', 'q.speed', 'dim.velocity')).toBe(true);
    expect(has('has_unit', 'q.distance', 'unit.kilometer')).toBe(true);
  });

  it('derives condition edges from equations and laws', () => {
    expect(has('requires_condition', 'eq.speed', 'cond.nonzero-time')).toBe(true);
    expect(has('requires_condition', 'law.motion', 'cond.nonzero-time')).toBe(true);
  });

  it('derives derivation edges in the declared direction', () => {
    expect(has('has_derivation', 'eq.speed', 'der.speed.time')).toBe(true);
    expect(has('produces', 'der.speed.time', 'eq.time')).toBe(true);
    expect(has('derived_from', 'eq.time', 'eq.speed')).toBe(true);
  });

  it('derives unit conversion edges inside a conversion group', () => {
    expect(has('equivalent_unit', 'unit.meter', 'unit.kilometer')).toBe(true);
    expect(has('equivalent_unit', 'unit.kilometer', 'unit.meter')).toBe(true);
    expect(has('equivalent_unit', 'unit.meter', 'unit.second')).toBe(false);
  });

  it('declares a contract for every edge kind and accepts the derived graph', () => {
    const kinds: EdgeKind[] = [
      'appears_in',
      'expresses',
      'derived_from',
      'has_unit',
      'has_dimension',
      'equivalent_unit',
      'requires_condition',
      'related_to',
      'has_derivation',
      'produces',
    ];
    for (const kind of kinds) expect(EDGE_REGISTRY[kind]).toBeDefined();
    const { kb } = buildKnowledgeBase(makeValidInput());
    expect(validateEdges(kb!.edges, kb!.entities)).toEqual([]);
  });

it('reports edges whose endpoints violate the contract', () => {
    const { kb } = buildKnowledgeBase(makeValidInput());
    const malformed: Edge = {
      id: 'appears_in:eq.speed->q.speed',
      kind: 'appears_in',
      from: 'eq.speed',
      to: 'q.speed',
      origin: 'derived',
    };
    const diagnostics = validateEdges([malformed], kb!.entities);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('edge-type-invalid');
  });

it('reports authored-only edges produced as derived', () => {
    const { kb } = buildKnowledgeBase(makeValidInput());
    const malformed: Edge = {
      id: 'related_to:q.speed->q.time',
      kind: 'related_to',
      from: 'q.speed',
      to: 'q.time',
      origin: 'derived',
    };
    const diagnostics = validateEdges([malformed], kb!.entities);
    expect(diagnostics.map((diagnostic) => diagnostic.code)).toContain('edge-origin-invalid');
  });

it('deduplicates identical edges and sorts them deterministically', () => {
    const ids = edges.map((edge) => edge.id);
    expect(new Set(ids).size).toBe(ids.length);
    const sorted = [...edges].sort((a, b) =>
      a.kind === b.kind
        ? a.from === b.from
          ? a.to.localeCompare(b.to)
          : a.from.localeCompare(b.from)
        : a.kind.localeCompare(b.kind),
    );
    expect(edges).toEqual(sorted);
  });
});