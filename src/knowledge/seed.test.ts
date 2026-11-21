import { describe, expect, it } from 'vitest';
import { LEVEL_KEYS } from '../domain/types.ts';
import { errorDiagnostics, loadKnowledgeBase, warningDiagnostics } from './index.ts';

describe('seed knowledge base', () => {
  const { kb, diagnostics } = loadKnowledgeBase();

  it('loads without errors and reports no warnings', () => {
    expect(errorDiagnostics(diagnostics)).toEqual([]);
    expect(warningDiagnostics(diagnostics)).toEqual([]);
    expect(kb).not.toBeNull();
  });

  it('contains the mechanics vertical slice', () => {
    expect(kb!.quantities.map((q) => q.id).sort()).toEqual([
      'q.acceleration',
      'q.charge',
      'q.current',
      'q.displacement',
      'q.force',
      'q.mass',
      'q.power',
      'q.resistance',
      'q.time',
      'q.velocity',
      'q.voltage',
      'q.work',
    ]);
    expect(kb!.equations.map((e) => e.id).sort()).toEqual([
      'eq.charge.current',
      'eq.newton2.acceleration',
      'eq.newton2.magnitudes',
      'eq.ohm.current',
      'eq.ohm.local',
      'eq.power.average',
      'eq.power.electric',
      'eq.power.time',
      'eq.velocity.uniform',
      'eq.work.constant-force',
      'eq.work.force',
    ]);
    expect(kb!.derivations).toHaveLength(4);
    expect(kb!.domains.map((domain) => domain.id).sort()).toEqual([
      'domain.electricity',
      'domain.mechanics',
    ]);
  });

  it('has level presentations for every teachable object', () => {
    for (const entity of [...kb!.quantities, ...kb!.laws, ...kb!.conditions]) {
      for (const level of LEVEL_KEYS) {
        expect(entity.levelPresentations[level], `${entity.id} @ ${level}`).toBeDefined();
      }
    }
  });

  it('has an explicit condition for every equation', () => {
    for (const equation of kb!.equations) {
      expect(equation.conditionsStatus).toBe('explicit');
      expect(equation.conditionRefs.length, equation.id).toBeGreaterThan(0);
    }
  });

  it('builds the expected derived edges', () => {
    const ids = new Set(kb!.edges.map((edge) => edge.id));
    expect(ids.has('appears_in:q.force->eq.newton2.magnitudes')).toBe(true);
    expect(ids.has('expresses:eq.newton2.magnitudes->law.newton.second')).toBe(true);
    expect(ids.has('derived_from:eq.newton2.acceleration->eq.newton2.magnitudes')).toBe(true);
    expect(ids.has('equivalent_unit:unit.kilometer->unit.meter')).toBe(true);
    expect(ids.has('expresses:eq.ohm.local->law.ohm')).toBe(true);
    expect(ids.has('appears_in:q.current->eq.ohm.local')).toBe(true);
  });
});