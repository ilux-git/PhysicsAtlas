import { describe, expect, it } from 'vitest';
import { makeValidInput } from '../test/fixtures.ts';
import { deriveEdges } from './derive.ts';

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