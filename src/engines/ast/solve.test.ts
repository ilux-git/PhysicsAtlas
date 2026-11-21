import { describe, expect, it } from 'vitest';
import { astEquals } from '../../domain/ast.ts';
import type { AstNode, Equation, Quantity } from '../../domain/types.ts';
import { loadKnowledgeBase } from '../../knowledge/index.ts';
import { baseEntity } from '../../test/factories.ts';
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
    physicalReview: 'draft',
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
    expect(result.reason).toContain('ноль');
  });
});