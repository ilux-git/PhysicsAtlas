import { astEquals } from '../domain/ast.ts';
import type {
  Derivation,
  Equation,
  ExpertReviewStatus,
  FormulationKind,
  KnowledgeBase,
} from '../domain/types.ts';
import { astToInfix } from './ast/parse.ts';
import { solveFor, solvedSideVariable } from './ast/solve.ts';
import { validateAst } from './ast/validate.ts';
import {
  checkEquationDimensions,
  formatDimension,
  quantityDimensionsFrom,
} from './dimensions.ts';

export interface StatusDetail {
  status: 'ok' | 'invalid' | 'unknown';
  messages: string[];
}

export interface EquationStatuses {
  structural: StatusDetail;
  dimensional: StatusDetail & { dimension?: string };
  formulation: FormulationKind;
  expert: ExpertReviewStatus;
  conditionsStatus: Equation['conditionsStatus'];
}

export function equationStatuses(equation: Equation, kb: KnowledgeBase): EquationStatuses {
  const quantities = new Map(kb.quantities.map((quantity) => [quantity.id, quantity]));
  const quantityDimensions = quantityDimensionsFrom(kb);

  const structuralProblems: string[] = [];
  const forms = [
    { label: 'основная форма', lhs: equation.lhsAst, rhs: equation.rhsAst },
    ...equation.alternativeForms.map((form) => ({
      label: `форма «${form.id}»`,
      lhs: form.lhsAst,
      rhs: form.rhsAst,
    })),
  ];
  for (const form of forms) {
    for (const problem of validateAst(form.lhs, { quantities })) {
      structuralProblems.push(`${form.label}, левая часть: ${problem}`);
    }
    for (const problem of validateAst(form.rhs, { quantities })) {
      structuralProblems.push(`${form.label}, правая часть: ${problem}`);
    }
  }

  const dimensionalMessages: string[] = [];
  let dimensionLabel: string | undefined;
  for (const form of forms) {
    const check = checkEquationDimensions(form.lhs, form.rhs, quantityDimensions);
    if (!check.ok) {
      dimensionalMessages.push(`${form.label}: ${check.message ?? 'размерности не совпадают.'}`);
    } else if (check.lhs) {
      dimensionLabel = formatDimension(check.lhs);
    }
  }

  return {
    structural:
      structuralProblems.length === 0
        ? { status: 'ok', messages: [] }
        : { status: 'invalid', messages: structuralProblems },
    dimensional:
      dimensionalMessages.length === 0
        ? { status: 'ok', messages: [], ...(dimensionLabel ? { dimension: dimensionLabel } : {}) }
        : { status: 'invalid', messages: dimensionalMessages },
    formulation: equation.review.formulation,
    expert: equation.review.expert,
    conditionsStatus: equation.conditionsStatus,
  };
}

export interface DerivationCheck {
  ok: boolean;
  message: string;
}

export function verifyDerivation(
  derivation: Derivation,
  source: Equation,
  target: Equation,
  kb: KnowledgeBase,
): DerivationCheck {
  const quantities = new Map(kb.quantities.map((quantity) => [quantity.id, quantity]));
  const symbols = new Map(kb.quantities.map((quantity) => [quantity.id, quantity.symbol]));
  const targetVariable = solvedSideVariable(target);
  if (!targetVariable) {
    return {
      ok: false,
      message: `Целевое уравнение «${target.id}» не решается относительно одной величины.`,
    };
  }
  const solved = solveFor(source, targetVariable, quantities);
  if (!solved.ok) {
    return { ok: false, message: solved.reason };
  }
  const targetExpression = target.lhsAst.type === 'variable' ? target.rhsAst : target.lhsAst;
  if (!astEquals(solved.ast, targetExpression)) {
    return {
      ok: false,
      message: `Вывод «${derivation.id}»: полученная форма «${astToInfix(solved.ast, symbols)}» не совпадает с целевой «${astToInfix(targetExpression, symbols)}».`,
    };
  }
  return { ok: true, message: 'Структурное преобразование совпадает с целевым уравнением.' };
}