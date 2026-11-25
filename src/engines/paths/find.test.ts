import { describe, expect, it } from 'vitest';
import type { Equation, KnowledgeInput, Quantity } from '../../domain/types.ts';
import { loadKnowledgeBase, buildKnowledgeBase } from '../../knowledge/index.ts';
import { baseEntity } from '../../test/factories.ts';
import { makeValidInput } from '../../test/fixtures.ts';
import { findPaths, pathHighlight } from './find.ts';

const { kb } = loadKnowledgeBase();
const MECHANICS_KNOWN = ['q.mass', 'q.acceleration', 'q.displacement', 'q.time'];
const MECHANICS_CONDITIONS = [
  'cond.inertial-frame',
  'cond.constant-mass',
  'cond.constant-force',
  'cond.force-along-displacement',
  'cond.nonzero-time',
];

function cyclicKnowledge(): KnowledgeInput {
  const input = makeValidInput();
  const quantityA: Quantity = {
    ...baseEntity('q.a', 'Величина A (цикл)'),
    kind: 'quantity',
    symbol: 'x',
    quantityKind: 'scalar',
    dimensionId: 'dim.length',
    unitIds: ['unit.meter'],
    preferredUnitId: 'unit.meter',
    definition: { ru: 'Тестовая величина A.' },
  };
  const quantityB: Quantity = {
    ...baseEntity('q.b', 'Величина B (цикл)'),
    kind: 'quantity',
    symbol: 'y',
    quantityKind: 'scalar',
    dimensionId: 'dim.length',
    unitIds: ['unit.meter'],
    preferredUnitId: 'unit.meter',
    definition: { ru: 'Тестовая величина B.' },
  };
  const equationA: Equation = {
    ...baseEntity('eq.a', 'x = y t'),
    kind: 'equation',
    lhsAst: { type: 'variable', quantityId: 'q.a' },
    rhsAst: {
      type: 'multiply',
      left: { type: 'variable', quantityId: 'q.b' },
      right: { type: 'variable', quantityId: 'q.time' },
    },
    displayLatex: 'x = y t',
    alternativeForms: [],
    lawRefs: [],
    conditionRefs: [],
    form: { kind: 'magnitudes' },
    conditionsStatus: 'missing',
  };
  const equationB: Equation = {
    ...baseEntity('eq.b', 'y = x / t'),
    kind: 'equation',
    lhsAst: { type: 'variable', quantityId: 'q.b' },
    rhsAst: {
      type: 'divide',
      left: { type: 'variable', quantityId: 'q.a' },
      right: { type: 'variable', quantityId: 'q.time' },
    },
    displayLatex: 'y = x / t',
    alternativeForms: [],
    lawRefs: [],
    conditionRefs: [],
    form: { kind: 'magnitudes' },
    conditionsStatus: 'missing',
  };
  input.quantities.push(quantityA, quantityB);
  input.equations.push(equationA, equationB);
  return input;
}

describe('computational path search', () => {
  it('finds the mechanics chain F = ma → A = Fs → P = A/t', () => {
    const result = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: MECHANICS_KNOWN,
      depthLimit: 3,
    });
    expect(result.reason).toBeNull();
    expect(result.paths.length).toBeGreaterThan(0);
    const path = result.paths[0];
    expect(path.steps.map((step) => step.equation.id)).toEqual([
      'eq.newton2.magnitudes',
      'eq.work.constant-force',
      'eq.power.average',
    ]);
    expect(path.steps.map((step) => step.targetId)).toEqual(['q.force', 'q.work', 'q.power']);
    expect(path.computation.status).toBe('symbolic');
    expect(path.conditionsStatus).toBe('unconfirmed');
    expect(path.review.expert).toBe('none');
    expect(path.conditions.map((condition) => condition.condition.id).sort()).toEqual(
      [...MECHANICS_CONDITIONS].sort(),
    );
    expect(path.conditions.every((condition) => condition.requiredBy.length > 0)).toBe(true);
  });

  it('reports confirmed conditions without claiming physical review', () => {
    const result = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: MECHANICS_KNOWN,
      confirmedConditionIds: MECHANICS_CONDITIONS,
      depthLimit: 3,
    });
    expect(result.paths[0]?.conditionsStatus).toBe('confirmed');
    expect(result.paths[0]?.review.expert).toBe('none');
    expect(result.paths[0]?.notes.join(' ')).toContain('модули векторных величин');
  });

  it('becomes invalid when a condition is violated', () => {
    const result = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: MECHANICS_KNOWN,
      confirmedConditionIds: MECHANICS_CONDITIONS,
      violatedConditionIds: ['cond.inertial-frame'],
      depthLimit: 3,
    });
    const path = result.paths.find((item) => item.conditions.some((condition) => condition.status === 'violated'));
    expect(path?.conditionsStatus).toBe('violated');
  });

  it('evaluates the chain numerically with units', () => {
    const result = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: MECHANICS_KNOWN,
      depthLimit: 3,
      values: new Map([
        ['q.mass', { value: 2, unitId: 'unit.kilogram' }],
        ['q.acceleration', { value: 3, unitId: 'unit.meter-per-second-squared' }],
        ['q.displacement', { value: 4, unitId: 'unit.meter' }],
        ['q.time', { value: 2, unitId: 'unit.second' }],
      ]),
    });
    const path = result.paths[0];
    expect(path.steps.map((step) => step.computed?.siValue)).toEqual([6, 24, 12]);
    expect(path.steps[2]?.computed?.unitId).toBe('unit.watt');
    expect(path.steps[2]?.computed?.value).toBeCloseTo(12, 10);
    expect(path.computation.status).toBe('numeric');
    expect(path.conditionsStatus).toBe('unconfirmed');
    expect(path.review.expert).toBe('none');
  });

  it('converts a numeric result into the requested target unit', () => {
    const result = findPaths(kb!, {
      targetId: 'q.displacement',
      knownIds: ['q.velocity', 'q.time'],
      depthLimit: 2,
      targetUnitId: 'unit.kilometer',
      values: new Map([
        ['q.velocity', { value: 10, unitId: 'unit.meter-per-second' }],
        ['q.time', { value: 3600, unitId: 'unit.second' }],
      ]),
    });
    const path = result.paths[0];
    expect(path?.computation.status).toBe('numeric');
    expect(path?.steps[0]?.computed?.unitId).toBe('unit.kilometer');
    expect(path?.steps[0]?.computed?.value).toBeCloseTo(36, 10);
    expect(path?.steps[0]?.computed?.siValue).toBeCloseTo(36000, 10);
  });

it('respects the depth limit and explains the failure', () => {
    const result = findPaths(kb!, { targetId: 'q.power', knownIds: MECHANICS_KNOWN, depthLimit: 2 });
    expect(result.paths).toHaveLength(0);
    expect(result.reason).toContain('глубине');
  });

  it('reports partial confirmation for a multi-step chain with different conditions', () => {
    const result = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: MECHANICS_KNOWN,
      confirmedConditionIds: ['cond.inertial-frame'],
      depthLimit: 3,
    });
    expect(result.paths[0]?.conditionsStatus).toBe('partial');
    const inertial = result.paths[0]?.conditions.find(
      (condition) => condition.condition.id === 'cond.inertial-frame',
    );
    expect(inertial?.requiredBy).toContain('eq.newton2.magnitudes');
    expect(inertial?.status).toBe('confirmed');
  });

it('propagates conditions required by a law, not only by its equation', () => {
    const input = makeValidInput();
    const law = input.laws[0];
    if (!law) throw new Error('Нет закона в фикстуре');
    law.conditionRefs = [...law.conditionRefs, 'cond.nonzero-speed'];
    const { kb: withLawCondition } = buildKnowledgeBase(input);
    const result = findPaths(withLawCondition!, {
      targetId: 'q.speed',
      knownIds: ['q.distance', 'q.time'],
      confirmedConditionIds: ['cond.nonzero-time'],
      depthLimit: 2,
    });
    const path = result.paths[0];
    expect(path?.conditions.map((condition) => condition.condition.id)).toContain('cond.nonzero-speed');
    expect(path?.conditionsStatus).toBe('partial');
    const propagated = path?.conditions.find(
      (condition) => condition.condition.id === 'cond.nonzero-speed',
    );
    expect(propagated?.requiredBy).toContain(law.id);
  });

it('treats a supplied zero denominator as a violated condition and a failed computation', () => {
    const result = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: MECHANICS_KNOWN,
      depthLimit: 3,
      values: new Map([
        ['q.mass', { value: 2, unitId: 'unit.kilogram' }],
        ['q.acceleration', { value: 3, unitId: 'unit.meter-per-second-squared' }],
        ['q.displacement', { value: 4, unitId: 'unit.meter' }],
        ['q.time', { value: 0, unitId: 'unit.second' }],
      ]),
    });
    const path = result.paths[0];
    expect(path?.conditionsStatus).toBe('violated');
    expect(path?.computation.status).toBe('failed');
  });

it('reports a target that no equation solves for', () => {
    const result = findPaths(kb!, { targetId: 'q.force', knownIds: [], depthLimit: 3 });
    const quantities = kb!.quantities;
    expect(quantities.length).toBeGreaterThan(0);
    expect(result.paths).toHaveLength(0);
    expect(result.reason).toContain('Не удалось построить цепочку');
  });

  it('returns a trivial valid path when the target is already known', () => {
    const result = findPaths(kb!, { targetId: 'q.force', knownIds: ['q.force'], depthLimit: 3 });
    expect(result.paths).toHaveLength(1);
    expect(result.paths[0]?.computation.status).toBe('symbolic');
    expect(result.paths[0]?.conditionsStatus).toBe('not-required');
    expect(result.paths[0]?.steps).toHaveLength(0);
  });

  it('finds a one-step electrical path and respects its condition', () => {
    const conditional = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: ['q.voltage', 'q.current'],
      depthLimit: 2,
    });
    expect(conditional.paths[0]?.steps.map((step) => step.equation.id)).toEqual([
      'eq.power.electric',
    ]);
    expect(conditional.paths[0]?.conditionsStatus).toBe('unconfirmed');

    const valid = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: ['q.voltage', 'q.current'],
      confirmedConditionIds: ['cond.same-element', 'cond.steady-current'],
      depthLimit: 2,
    });
    expect(valid.paths[0]?.conditionsStatus).toBe('confirmed');
    expect(valid.paths[0]?.review.expert).toBe('none');
  });

  it('builds a cross-domain chain U, R → I → P', () => {
    const result = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: ['q.voltage', 'q.resistance'],
      depthLimit: 2,
    });
    expect(result.paths[0]?.steps.map((step) => step.equation.id)).toEqual([
      'eq.ohm.current',
      'eq.power.electric',
    ]);
  });

  it('keeps a path containing a formula pending review visibly unreviewed', () => {
    const input = makeValidInput();
    const equation = input.equations.find((item) => item.id === 'eq.speed');
    if (!equation) throw new Error('Нет уравнения eq.speed');
    equation.review = { formulation: 'draft', expert: 'requested' };
    const { kb: reviewed } = buildKnowledgeBase(input);
    const result = findPaths(reviewed!, {
      targetId: 'q.speed',
      knownIds: ['q.distance', 'q.time'],
      confirmedConditionIds: ['cond.nonzero-time'],
      depthLimit: 2,
    });
    expect(result.paths[0]?.review.expert).toBe('requested');
    expect(result.paths[0]?.review.formulation).toBe('draft');
    expect(result.paths[0]?.conditionsStatus).toBe('confirmed');
  });

  it('terminates on cyclic computational dependencies', () => {
    const { kb: cyclic } = buildKnowledgeBase(cyclicKnowledge());
    const result = findPaths(cyclic!, {
      targetId: 'q.a',
      knownIds: ['q.time'],
      depthLimit: 4,
    });
    expect(result.paths).toHaveLength(0);
    expect(result.reason).not.toBeNull();
  });

  it('builds a map highlight for the whole chain', () => {
    const result = findPaths(kb!, { targetId: 'q.power', knownIds: MECHANICS_KNOWN, depthLimit: 3 });
    const highlight = pathHighlight(result.paths[0]);
    expect(highlight.nodes).toContain('q.power');
    expect(highlight.nodes).toContain('eq.work.constant-force');
    expect(highlight.nodes).toContain('cond.constant-force');
    expect(highlight.edges).toContain('appears_in:q.force->eq.work.constant-force');
    expect(highlight.edges).toContain('requires_condition:eq.work.constant-force->cond.constant-force');
  });
});