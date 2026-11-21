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

  it('states the direct-current context of P = UI and distinguishes average velocity', () => {
    const power = kb!.equations.find((equation) => equation.id === 'eq.power.electric');
    expect(power?.conditionRefs).toContain('cond.steady-current');
    expect(power?.form.note?.ru).toMatch(/Постоянный ток/);
    expect(power?.form.note?.ru).toMatch(/переменном токе/);
    expect(power?.description.ru).toMatch(/постоянному току/);

    const velocity = kb!.equations.find((equation) => equation.id === 'eq.velocity.uniform');
    expect(velocity?.form.note?.ru).toMatch(/среднюю скорость/);
  });

it('keeps the required physical caveats in equation form notes', () => {
    const notes = new Map(
      kb!.equations.map((equation) => [equation.id, equation.form.note?.ru ?? '']),
    );
    expect(notes.get('eq.newton2.magnitudes')).toMatch(/модул|направление/);
    expect(notes.get('eq.work.constant-force')).toMatch(/угол/);
    expect(notes.get('eq.power.average')).toMatch(/средняя/);
    expect(notes.get('eq.velocity.uniform')).toMatch(/среднюю скорость/);
    expect(notes.get('eq.ohm.local')).toMatch(/один и тот же участок/);
    expect(notes.get('eq.charge.current')).toMatch(/Постоянный ток/);
    expect(notes.get('eq.power.electric')).toMatch(/Постоянный ток|постоянном токе/);
  });

it('does not claim any expert review in the seed content', () => {
    for (const entity of kb!.entities.values()) {
      expect(entity.review.expert, entity.id).toBe('none');
      expect(entity.review.reviewer, entity.id).toBeUndefined();
      expect(entity.review.reviewedAt, entity.id).toBeUndefined();
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