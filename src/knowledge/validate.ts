import { astEquals, collectQuantityIds } from '../domain/ast.ts';
import type {
  Diagnostic,
  DimensionVector,
  Entity,
  EntityKind,
  KnowledgeInput,
} from '../domain/types.ts';
import { astToInfix } from '../engines/ast/parse.ts';
import { solveFor, solvedSideVariable } from '../engines/ast/solve.ts';
import { checkEquationDimensions } from '../engines/dimensions.ts';

const KIND_PREFIX: Record<EntityKind, string> = {
  quantity: 'q.',
  equation: 'eq.',
  law: 'law.',
  unit: 'unit.',
  dimension: 'dim.',
  condition: 'cond.',
  derivation: 'der.',
};

import { normalizeLatex } from '../domain/text.ts';

export { normalizeLatex };

export function validateKnowledge(input: KnowledgeInput): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const error = (code: string, message: string, entityId?: string): void => {
    diagnostics.push({ severity: 'error', code, message, entityId });
  };
  const warn = (code: string, message: string, entityId?: string): void => {
    diagnostics.push({ severity: 'warning', code, message, entityId });
  };

  const dimensions = new Map(input.dimensions.map((d) => [d.id, d]));
  const units = new Map(input.units.map((u) => [u.id, u]));
  const quantities = new Map(input.quantities.map((q) => [q.id, q]));
  const laws = new Map(input.laws.map((l) => [l.id, l]));
  const conditions = new Map(input.conditions.map((c) => [c.id, c]));
  const equations = new Map(input.equations.map((e) => [e.id, e]));
  const domains = new Map(input.domains.map((d) => [d.id, d]));
  const sources = new Map(input.sources.map((s) => [s.id, s]));

  const allEntities: Entity[] = [
    ...input.quantities,
    ...input.equations,
    ...input.laws,
    ...input.units,
    ...input.dimensions,
    ...input.conditions,
    ...input.derivations,
  ];

  const seenIds = new Set<string>();
  for (const entity of allEntities) {
    if (seenIds.has(entity.id)) {
      error('duplicate-id', `Идентификатор «${entity.id}» объявлен несколько раз.`, entity.id);
    } else {
      seenIds.add(entity.id);
    }
    const prefix = KIND_PREFIX[entity.kind];
    if (!entity.id.startsWith(prefix)) {
      error(
        'id-prefix',
        `Идентификатор «${entity.id}» не соответствует типу «${entity.kind}»: ожидается префикс «${prefix}».`,
        entity.id,
      );
    }
    if (entity.domains.length === 0) {
      warn('domain-missing', `У сущности «${entity.id}» не указан раздел физики.`, entity.id);
    }
    for (const domainId of entity.domains) {
      if (!domains.has(domainId)) {
        error('ref-missing', `Раздел «${domainId}» не существует (сущность «${entity.id}»).`, entity.id);
      }
    }
    if (entity.sources.length === 0) {
      warn('source-missing', `У сущности «${entity.id}» не указан источник.`, entity.id);
    }
    for (const sourceId of entity.sources) {
      if (!sources.has(sourceId)) {
        error('ref-missing', `Источник «${sourceId}» не существует (сущность «${entity.id}»).`, entity.id);
      }
    }
    for (const [level, presentation] of Object.entries(entity.levelPresentations)) {
      for (const link of presentation.extraLinks ?? []) {
        if (!seenIds.has(link.targetId) && !allEntities.some((e) => e.id === link.targetId)) {
          error(
            'ref-missing',
            `Дополнительная связь уровня ${level} указывает на «${link.targetId}», которой нет.`,
            entity.id,
          );
        }
      }
    }
  }

  const symbols = new Map<string, string>();
  const dimensionVectors = new Map(
    input.dimensions.map((dimension) => [dimension.id, dimension.exponents]),
  );
  const quantityDimensions = new Map<string, DimensionVector>();
  const quantityById = new Map(input.quantities.map((quantity) => [quantity.id, quantity]));
  const quantitySymbols = new Map(input.quantities.map((quantity) => [quantity.id, quantity.symbol]));
  for (const quantity of input.quantities) {
    const vector = dimensionVectors.get(quantity.dimensionId);
    if (vector) quantityDimensions.set(quantity.id, vector);
  }

  for (const quantity of input.quantities) {
    if (!dimensions.has(quantity.dimensionId)) {
      error(
        'ref-missing',
        `Размерность «${quantity.dimensionId}» не существует (величина «${quantity.id}»).`,
        quantity.id,
      );
    }
    const existing = symbols.get(quantity.symbol);
    if (existing !== undefined && existing !== quantity.id) {
      error(
        'symbol-duplicate',
        `Символ «${quantity.symbol}» используется и величиной «${existing}», и «${quantity.id}»; формулы станут неоднозначными.`,
        quantity.id,
      );
    } else {
      symbols.set(quantity.symbol, quantity.id);
    }
    for (const unitId of quantity.unitIds) {
      const unit = units.get(unitId);
      if (!unit) {
        error('ref-missing', `Единица «${unitId}» не существует (величина «${quantity.id}»).`, quantity.id);
        continue;
      }
      if (!dimensions.has(unit.dimensionId)) {
        error('ref-missing', `Размерность «${unit.dimensionId}» единицы «${unitId}» не существует.`, quantity.id);
      } else if (unit.dimensionId !== quantity.dimensionId) {
        error(
          'unit-dimension-mismatch',
          `Единица «${unitId}» имеет размерность «${unit.dimensionId}», а величина «${quantity.id}» — «${quantity.dimensionId}».`,
          quantity.id,
        );
      }
    }
    if (!quantity.unitIds.includes(quantity.preferredUnitId)) {
      error(
        'ref-missing',
        `Предпочтительная единица «${quantity.preferredUnitId}» отсутствует в списке единиц величины «${quantity.id}».`,
        quantity.id,
      );
    }
  }

  const groupDimensions = new Map<string, string>();
  const altFormIds = new Set<string>();
  for (const unit of input.units) {
    if (!dimensions.has(unit.dimensionId)) {
      error(
        'ref-missing',
        `Размерность «${unit.dimensionId}» не существует (единица «${unit.id}»).`,
        unit.id,
      );
    }
    const groupDimension = groupDimensions.get(unit.conversionGroup);
    if (groupDimension === undefined) {
      groupDimensions.set(unit.conversionGroup, unit.dimensionId);
    } else if (groupDimension !== unit.dimensionId) {
      error(
        'unit-group-dimension',
        `Группа конвертации «${unit.conversionGroup}» объединяет единицы разных размерностей: «${groupDimension}» и «${unit.dimensionId}» (единица «${unit.id}»).`,
        unit.id,
      );
    }
  }

  for (const law of input.laws) {
    for (const conditionId of law.conditionRefs) {
      if (!conditions.has(conditionId)) {
        error('ref-missing', `Условие «${conditionId}» не существует (закон «${law.id}»).`, law.id);
      }
    }
  }

  for (const condition of input.conditions) {
    const quantityId = condition.structured?.quantityId;
    if (quantityId && !quantities.has(quantityId)) {
      error(
        'ref-missing',
        `Структурное ограничение ссылается на величину «${quantityId}», которой нет (условие «${condition.id}»).`,
        condition.id,
      );
    }
  }

  for (const equation of input.equations) {
    for (const lawId of equation.lawRefs) {
      if (!laws.has(lawId)) {
        if (allEntities.some((e) => e.id === lawId)) {
          error('ref-kind-mismatch', `«${lawId}» — не закон (уравнение «${equation.id}»).`, equation.id);
        } else {
          error('ref-missing', `Закон «${lawId}» не существует (уравнение «${equation.id}»).`, equation.id);
        }
      }
    }
    for (const conditionId of equation.conditionRefs) {
      if (!conditions.has(conditionId)) {
        if (allEntities.some((e) => e.id === conditionId)) {
          error('ref-kind-mismatch', `«${conditionId}» — не условие (уравнение «${equation.id}»).`, equation.id);
        } else {
          error('ref-missing', `Условие «${conditionId}» не существует (уравнение «${equation.id}»).`, equation.id);
        }
      }
    }

    if (equation.conditionsStatus === 'explicit' && equation.conditionRefs.length === 0) {
      error(
        'conditions-missing',
        `Уравнение «${equation.id}» объявляет условия явными, но не ссылается ни на одно условие.`,
        equation.id,
      );
    }
    if (equation.conditionsStatus === 'missing' && equation.conditionRefs.length > 0) {
      warn(
        'conditions-status-mismatch',
        `Уравнение «${equation.id}» ссылается на условия, но статус условий — «не указаны».`,
        equation.id,
      );
    }

    const forms = [
      { label: 'основная форма', lhs: equation.lhsAst, rhs: equation.rhsAst, latex: equation.displayLatex },
      ...equation.alternativeForms.map((form) => ({
        label: `форма «${form.id}»`,
        lhs: form.lhsAst,
        rhs: form.rhsAst,
        latex: form.displayLatex,
      })),
    ];

    for (const form of forms) {
      const variableIds = new Set([
        ...collectQuantityIds(form.lhs),
        ...collectQuantityIds(form.rhs),
      ]);
      for (const variableId of variableIds) {
        const quantity = quantities.get(variableId);
        if (!quantity) {
          error(
            'ast-variable-missing',
            `Формула ${form.label} уравнения «${equation.id}» ссылается на величину «${variableId}», которой нет.`,
            equation.id,
          );
          continue;
        }
        if (!normalizeLatex(form.latex).includes(normalizeLatex(quantity.symbol))) {
          error(
            'display-symbol-missing',
            `В отображении «${form.latex}» нет символа «${quantity.symbol}» величины «${quantity.id}» (уравнение «${equation.id}», ${form.label}).`,
            equation.id,
          );
        }
      }
    }

    for (const form of equation.alternativeForms) {
      if (altFormIds.has(form.id)) {
        error('duplicate-id', `Форма «${form.id}» объявлена несколько раз.`, equation.id);
      } else {
        altFormIds.add(form.id);
      }
    }

    for (const form of forms) {
      const check = checkEquationDimensions(form.lhs, form.rhs, quantityDimensions);
      if (!check.ok) {
        error(
          'dimension-mismatch',
          `Формула ${form.label} уравнения «${equation.id}»: ${check.message ?? 'размерности не совпадают.'}`,
          equation.id,
        );
      }
    }
  }

  for (const derivation of input.derivations) {
    const source = equations.get(derivation.sourceEquationId);
    const target = equations.get(derivation.targetEquationId);
    if (!source) {
      error(
        'ref-missing',
        `Исходное уравнение «${derivation.sourceEquationId}» не существует (вывод «${derivation.id}»).`,
        derivation.id,
      );
    }
    if (!target) {
      error(
        'ref-missing',
        `Целевое уравнение «${derivation.targetEquationId}» не существует (вывод «${derivation.id}»).`,
        derivation.id,
      );
    }
    if (
      source &&
      target &&
      derivation.sourceEquationId === derivation.targetEquationId
    ) {
      error('derivation-self', `Вывод «${derivation.id}» ссылается на одно и то же уравнение.`, derivation.id);
    }
    for (const conditionId of derivation.preconditions) {
      if (!conditions.has(conditionId)) {
        error(
          'ref-missing',
          `Предусловие «${conditionId}» не существует (вывод «${derivation.id}»).`,
          derivation.id,
        );
      }
    }
    if (source && target && source.id !== target.id) {
      const targetVariable = solvedSideVariable(target);
      if (!targetVariable) {
        error(
          'derivation-unverifiable',
          `Целевое уравнение «${target.id}» вывода «${derivation.id}» не решается относительно одной величины.`,
          derivation.id,
        );
      } else {
        const solved = solveFor(source, targetVariable, quantityById);
        if (!solved.ok) {
          error(
            'derivation-unverifiable',
            `Вывод «${derivation.id}» не проверяется: ${solved.reason}`,
            derivation.id,
          );
        } else {
          const targetExpression =
            target.lhsAst.type === 'variable' ? target.rhsAst : target.lhsAst;
          if (!astEquals(solved.ast, targetExpression)) {
            error(
              'derivation-mismatch',
              `Вывод «${derivation.id}»: получено «${astToInfix(solved.ast, quantitySymbols)}», а в целевом уравнении «${astToInfix(targetExpression, quantitySymbols)}».`,
              derivation.id,
            );
          }
        }
      }
    }

    const orders = derivation.steps.map((step) => step.order);
    const expected = orders.map((_, index) => index + 1);
    if (orders.length !== new Set(orders).size || orders.join(',') !== expected.join(',')) {
      error(
        'derivation-step-order',
        `Шаги вывода «${derivation.id}» должны идти подряд, начиная с 1; получено: ${orders.join(', ')}.`,
        derivation.id,
      );
    }
  }

  return diagnostics;
}

export function errorsOnly(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
}