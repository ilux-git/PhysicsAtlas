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
    physicalReview: 'draft',
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
    physicalReview: 'draft',
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
    expect(path.status).toBe('conditional');
    expect(path.conditions.map((condition) => condition.condition.id).sort()).toEqual(
      [...MECHANICS_CONDITIONS].sort(),
    );
  });

  it('becomes valid when all conditions are confirmed', () => {
    const result = findPaths(kb!, {
      targetId: 'q.power',
      knownIds: MECHANICS_KNOWN,
      confirmedConditionIds: MECHANICS_CONDITIONS,
      depthLimit: 3,
    });
    expect(result.paths[0]?.status).toBe('valid');
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
    expect(path?.status).toBe('invalid');
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
  });

  it('respects the depth limit and explains the failure', () => {
    const result = findPaths(kb!, { targetId: 'q.power', knownIds: MECHANICS_KNOWN, depthLimit: 2 });
    expect(result.paths).toHaveLength(0);
    expect(result.reason).toContain('глубине');
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
    expect(result.paths[0]?.status).toBe('valid');
    expect(result.paths[0]?.steps).toHaveLength(0);
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