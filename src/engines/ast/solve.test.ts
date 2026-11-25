import { describe, expect, it } from 'vitest';
import { astEquals } from '../../domain/ast.ts';
import type { AstNode, Equation, Quantity } from '../../domain/types.ts';
import { loadKnowledgeBase } from '../../knowledge/index.ts';
import { baseEntity } from '../../test/factories.ts';
import { evaluate, evaluateEquation } from './evaluate.ts';
import { solveFor } from './solve.ts';

const { kb } = loadKnowledgeBase();
const equationById = new Map(kb!.equations.map((equation) => [equation.id, equation]));
const quantities: ReadonlyMap<string, Quantity> = new Map(
  kb!.quantities.map((quantity) => [quantity.id, quantity]),
);

function equationWith(id: string, lhsAst: AstNode, rhsAst: AstNode): Equation {
  return {
    ...baseEntity(id, 'Тестовое уравнение'),
    kind: 'equation',
    lhsAst,
    rhsAst,
    displayLatex: 'x = x',
    alternativeForms: [],
    lawRefs: [],
    conditionRefs: [],
    form: { kind: 'magnitudes' },
    conditionsStatus: 'missing',
  };
}

function seededEquation(id: string): Equation {
  const equation = equationById.get(id);
  if (!equation) throw new Error(`Нет уравнения ${id}`);
  return equation;
}

describe('limited algebraic solver', () => {
  it('expresses acceleration from F = ma with a non-zero-mass precondition', () => {
    const result = solveFor(seededEquation('eq.newton2.magnitudes'), 'q.acceleration', quantities);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(astEquals(result.ast, seededEquation('eq.newton2.acceleration').rhsAst)).toBe(true);
    expect(result.preconditions.some((precondition) => precondition.text.includes('m ≠ 0'))).toBe(true);
  });

  it('expresses force from A = Fs', () => {
    const result = solveFor(seededEquation('eq.work.constant-force'), 'q.force', quantities);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(astEquals(result.ast, seededEquation('eq.work.force').rhsAst)).toBe(true);
    expect(result.preconditions.some((precondition) => precondition.text.includes('s ≠ 0'))).toBe(true);
  });

  it('expresses time from P = A/t and keeps both division constraints', () => {
    const result = solveFor(seededEquation('eq.power.average'), 'q.time', quantities);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(astEquals(result.ast, seededEquation('eq.power.time').rhsAst)).toBe(true);
    expect(result.preconditions.some((precondition) => precondition.text.includes('t ≠ 0'))).toBe(true);
    expect(result.preconditions.some((precondition) => precondition.text.includes('P ≠ 0'))).toBe(true);
  });

  it('refuses a target that is not in the equation', () => {
    const result = solveFor(seededEquation('eq.newton2.magnitudes'), 'q.power', quantities);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('не входит');
  });

  it('refuses a target that appears more than once', () => {
    const equation = equationWith(
      'eq.test.repeated',
      { type: 'variable', quantityId: 'q.force' },
      {
        type: 'multiply',
        left: { type: 'variable', quantityId: 'q.force' },
        right: { type: 'variable', quantityId: 'q.time' },
      },
    );
    const result = solveFor(equation, 'q.force', quantities);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('несколько раз');
  });

  it('refuses a division by a literal zero', () => {
    const equation = equationWith(
      'eq.test.zero',
      { type: 'variable', quantityId: 'q.work' },
      {
        type: 'multiply',
        left: { type: 'variable', quantityId: 'q.force' },
        right: { type: 'constant', name: '0', value: 0 },
      },
    );
    const result = solveFor(equation, 'q.force', quantities);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('domain-violation');
    expect(result.reason).toContain('ноль');
  });

  it('refuses a square equation instead of selecting one root', () => {
    const equation = equationWith(
      'eq.test.square',
      { type: 'constant', name: '9', value: 9 },
      { type: 'power', base: { type: 'variable', quantityId: 'q.displacement' }, exponent: 2 },
    );
    const result = solveFor(equation, 'q.displacement', quantities);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('multiple-solutions');
    expect(result.reason).toContain('±');
  });

  it('distinguishes a square equation with no real solutions', () => {
    const equation = equationWith(
      'eq.test.square-negative',
      { type: 'constant', name: '-1', value: -1 },
      { type: 'power', base: { type: 'variable', quantityId: 'q.displacement' }, exponent: 2 },
    );
    const result = solveFor(equation, 'q.displacement', quantities);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.code).toBe('no-real-solutions');
  });

  it('solves a principal square root and rejects a negative right side', () => {
    const equation = equationWith(
      'eq.test.root',
      { type: 'variable', quantityId: 'q.time' },
      { type: 'sqrt', arg: { type: 'variable', quantityId: 'q.displacement' } },
    );
    const solved = solveFor(equation, 'q.displacement', quantities);
    expect(solved.ok).toBe(true);
    if (solved.ok) {
      expect(solved.ast).toEqual({
        type: 'power',
        base: { type: 'variable', quantityId: 'q.time' },
        exponent: 2,
      });
      expect(solved.preconditions.some((item) => item.text.includes('t ≥ 0'))).toBe(true);
    }

    const negative = equationWith(
      'eq.test.root-negative',
      { type: 'constant', name: '-4', value: -4 },
      { type: 'sqrt', arg: { type: 'variable', quantityId: 'q.displacement' } },
    );
    const refused = solveFor(negative, 'q.displacement', quantities);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.code).toBe('no-real-solutions');
  });

  it('keeps domain constraints that are outside the target path', () => {
    const square = equationWith(
      'eq.test.domain-root',
      { type: 'variable', quantityId: 'q.velocity' },
      {
        type: 'add',
        left: { type: 'variable', quantityId: 'q.time' },
        right: { type: 'sqrt', arg: { type: 'variable', quantityId: 'q.displacement' } },
      },
    );
    const solved = solveFor(square, 'q.velocity', quantities);
    expect(solved.ok).toBe(true);
    if (solved.ok) {
      expect(solved.preconditions.some((item) => item.kind === 'nonnegative' && item.text.includes('s'))).toBe(true);
    }

    const division = equationWith(
      'eq.test.domain-division',
      { type: 'variable', quantityId: 'q.velocity' },
      {
        type: 'add',
        left: { type: 'variable', quantityId: 'q.time' },
        right: {
          type: 'divide',
          left: { type: 'constant', name: '1', value: 1 },
          right: { type: 'variable', quantityId: 'q.displacement' },
        },
      },
    );
    const divided = solveFor(division, 'q.velocity', quantities);
    expect(divided.ok).toBe(true);
    if (divided.ok) {
      expect(divided.preconditions.some((item) => item.kind === 'nonzero' && item.text.includes('s'))).toBe(true);
    }
  });

  it('reports a literal domain violation in the source equation', () => {
    const equation = equationWith(
      'eq.test.domain-broken',
      { type: 'variable', quantityId: 'q.velocity' },
      {
        type: 'add',
        left: { type: 'variable', quantityId: 'q.time' },
        right: { type: 'sqrt', arg: { type: 'constant', name: '-1', value: -1 } },
      },
    );
    const result = solveFor(equation, 'q.velocity', quantities);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('domain-violation');
  });

  it('refuses unsupported powers, including negative exponents', () => {
    const equation = equationWith(
      'eq.test.negative-power',
      { type: 'variable', quantityId: 'q.time' },
      { type: 'power', base: { type: 'variable', quantityId: 'q.acceleration' }, exponent: -1 },
    );
    const result = solveFor(equation, 'q.acceleration', quantities);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('unsupported-power');
  });

  it('returns a numerically consistent solution for the source equation', () => {
    const equation = seededEquation('eq.newton2.magnitudes');
    const result = solveFor(equation, 'q.acceleration', quantities);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const values = new Map([
      ['q.force', 6],
      ['q.mass', 2],
      ['q.acceleration', 3],
    ]);
    const check = evaluateEquation(equation.lhsAst, equation.rhsAst, values);
    expect(check.difference).toBeCloseTo(0, 12);
    expect(evaluate(result.ast, values)).toBeCloseTo(3, 12);
  });
});