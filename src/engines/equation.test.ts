import { describe, expect, it } from 'vitest';
import type { Equation } from '../domain/types.ts';
import { loadKnowledgeBase } from '../knowledge/index.ts';
import { baseEntity } from '../test/factories.ts';
import { equationStatuses, verifyDerivation } from './equation.ts';

const { kb } = loadKnowledgeBase();
const equationById = new Map(kb!.equations.map((equation) => [equation.id, equation]));
const derivationById = new Map(kb!.derivations.map((derivation) => [derivation.id, derivation]));

function seededEquation(id: string): Equation {
  const equation = equationById.get(id);
  if (!equation) throw new Error(`Нет уравнения ${id}`);
  return equation;
}

describe('equation statuses', () => {
  it('keeps structural, dimensional, review and condition statuses separate', () => {
    const statuses = equationStatuses(seededEquation('eq.newton2.magnitudes'), kb!);
    expect(statuses.structural.status).toBe('ok');
    expect(statuses.dimensional.status).toBe('ok');
    expect(statuses.dimensional.dimension).toBe('L·M·T⁻²');
    expect(statuses.physicalReview).toBe('standard-form');
    expect(statuses.conditionsStatus).toBe('explicit');
  });

  it('does not promote a dimensionally valid but unverified formula', () => {
    const source = seededEquation('eq.newton2.magnitudes');
    const scaled: Equation = {
      ...structuredClone(source),
      id: 'eq.test.scaled',
      physicalReview: 'draft',
      rhsAst: {
        type: 'multiply',
        left: { type: 'constant', name: '2', value: 2 },
        right: source.rhsAst,
      },
    };
    const statuses = equationStatuses(scaled, kb!);
    expect(statuses.dimensional.status).toBe('ok');
    expect(statuses.physicalReview).toBe('draft');
  });

  it('reports a dimensional mismatch with the reason', () => {
    const broken: Equation = {
      ...structuredClone(seededEquation('eq.newton2.magnitudes')),
      id: 'eq.test.broken',
      rhsAst: {
        type: 'multiply',
        left: { type: 'variable', quantityId: 'q.mass' },
        right: { type: 'variable', quantityId: 'q.displacement' },
      },
    };
    const statuses = equationStatuses(broken, kb!);
    expect(statuses.dimensional.status).toBe('invalid');
    expect(statuses.dimensional.messages.join(' ')).toContain('L·M·T⁻²');
  });
});

describe('derivation verification', () => {
  it('accepts every seeded derivation as a structural rewrite', () => {
    for (const derivation of kb!.derivations) {
      const check = verifyDerivation(
        derivation,
        seededEquation(derivation.sourceEquationId),
        seededEquation(derivation.targetEquationId),
        kb!,
      );
      expect(check.ok, `${derivation.id}: ${check.message}`).toBe(true);
    }
  });

  it('rejects a target that does not match the solved form', () => {
    const derivation = derivationById.get('der.newton2.acceleration');
    if (!derivation) throw new Error('Нет вывода');
    const wrong: Equation = {
      ...structuredClone(seededEquation('eq.newton2.acceleration')),
      id: 'eq.test.wrong',
      lhsAst: { type: 'variable', quantityId: 'q.acceleration' },
      rhsAst: { type: 'variable', quantityId: 'q.force' },
    };
    const check = verifyDerivation(
      derivation,
      seededEquation(derivation.sourceEquationId),
      wrong,
      kb!,
    );
    expect(check.ok).toBe(false);
    expect(check.message).toContain('не совпадает');
  });

  it('rejects a derivation of an equation with no isolated target', () => {
    const equation = {
      ...baseEntity('eq.test.sum', 'Сумма'),
      kind: 'equation' as const,
      lhsAst: {
        type: 'add' as const,
        left: { type: 'variable' as const, quantityId: 'q.force' },
        right: { type: 'variable' as const, quantityId: 'q.work' },
      },
      rhsAst: {
        type: 'add' as const,
        left: { type: 'variable' as const, quantityId: 'q.power' },
        right: { type: 'variable' as const, quantityId: 'q.time' },
      },
      displayLatex: 'F + A = P + t',
      alternativeForms: [],
      lawRefs: [],
      conditionRefs: [],
      form: { kind: 'magnitudes' as const },
      physicalReview: 'draft' as const,
      conditionsStatus: 'missing' as const,
    };
    const derivation = {
      ...baseEntity('der.test.sum', 'Тестовый вывод'),
      kind: 'derivation' as const,
      sourceEquationId: 'eq.test.sum',
      targetEquationId: 'eq.test.sum',
      steps: [
        {
          order: 1,
          description: 'Тест',
          operation: 'rewrite' as const,
          displayFrom: 'F + A = P',
          displayTo: 'F + A = P',
        },
      ],
      preconditions: [],
      verificationStatus: 'draft' as const,
    };
    const check = verifyDerivation(derivation, equation, equation, kb!);
    expect(check.ok).toBe(false);
    expect(check.message).toContain('не решается');
  });
});