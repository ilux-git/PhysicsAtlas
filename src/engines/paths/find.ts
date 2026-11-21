import type {
  AstNode,
  Condition,
  Equation,
  ExpertReviewStatus,
  FormulationKind,
  KnowledgeBase,
  Quantity,
} from '../../domain/types.ts';
import { collectQuantityIds } from '../../domain/ast.ts';
import { evaluate, EvaluationError } from '../ast/evaluate.ts';
import { solveFor, type SolvePrecondition } from '../ast/solve.ts';
import { fromSI, toSI } from '../units.ts';

export interface PathValueInput {
  value: number;
  unitId: string;
}

export interface FindPathsOptions {
  targetId: string;
  knownIds: readonly string[];
  values?: ReadonlyMap<string, PathValueInput>;
  confirmedConditionIds?: readonly string[];
  violatedConditionIds?: readonly string[];
  depthLimit?: number;
  maxPaths?: number;
  targetUnitId?: string;
}

export type ComputationStatus = 'numeric' | 'symbolic' | 'failed';

export type PathConditionsStatus =
  | 'not-required'
  | 'confirmed'
  | 'partial'
  | 'unconfirmed'
  | 'violated';

export type FormulationSummary = FormulationKind | 'mixed';

export interface PathReview {
  formulation: FormulationSummary;
  expert: ExpertReviewStatus;
  perEquation: Array<{
    equationId: string;
    formulation: FormulationKind;
    expert: ExpertReviewStatus;
  }>;
}

export interface PathStep {
  equation: Equation;
  targetId: string;
  ast: AstNode;
  preconditions: SolvePrecondition[];
  computed: { siValue: number; value: number; unitId: string } | null;
}

export interface PathCondition {
  condition: Condition;
  status: 'confirmed' | 'unconfirmed' | 'violated';
  requiredBy: string[];
}

export interface PathResult {
  id: string;
  targetId: string;
  computation: { status: ComputationStatus; messages: string[] };
  conditionsStatus: PathConditionsStatus;
  review: PathReview;
  steps: PathStep[];
  conditions: PathCondition[];
  unverifiedConstraints: string[];
  notes: string[];
  knownIds: string[];
}

export interface FindPathsResult {
  target: Quantity | null;
  paths: PathResult[];
  reason: string | null;
}

interface RawStep {
  equation: Equation;
  targetId: string;
  ast: AstNode;
  preconditions: SolvePrecondition[];
}

interface RawChain {
  steps: RawStep[];
  conditionIds: string[];
  unverifiedConstraints: string[];
  notes: string[];
}

function quantityVariables(ast: AstNode): string[] {
  return [...collectQuantityIds(ast)];
}

function mapPrecondition(
  precondition: SolvePrecondition,
  kb: KnowledgeBase,
): { conditionId: string } | { constraint: string } {
  if (precondition.quantityId) {
    const condition = kb.conditions.find(
      (item) =>
        item.structured?.type === 'nonzero' &&
        item.structured.quantityId === precondition.quantityId,
    );
    if (condition) return { conditionId: condition.id };
  }
  return { constraint: `Непроверенное ограничение: ${precondition.text}` };
}

function equationNotes(equation: Equation, kb: KnowledgeBase): string[] {
  const notes: string[] = [];
  if (equation.form.kind === 'magnitudes') {
    const variables = new Set([...quantityVariables(equation.lhsAst), ...quantityVariables(equation.rhsAst)]);
    const hasVector = [...variables].some(
      (quantityId) => kb.quantities.find((quantity) => quantity.id === quantityId)?.quantityKind === 'vector',
    );
    if (hasVector) {
      notes.push(
        'Используются модули векторных величин; направление в цепочке не проверяется.',
      );
    }
  }
  return notes;
}

export function findPaths(kb: KnowledgeBase, options: FindPathsOptions): FindPathsResult {
  const quantities = new Map(kb.quantities.map((quantity) => [quantity.id, quantity]));
  const units = new Map(kb.units.map((unit) => [unit.id, unit]));
  const target = quantities.get(options.targetId) ?? null;

  if (!target) {
    return { target: null, paths: [], reason: `Величина «${options.targetId}» не найдена.` };
  }

  const known = new Set(options.knownIds.filter((id) => quantities.has(id)));
  const confirmed = new Set(options.confirmedConditionIds ?? []);
  const violated = new Set(options.violatedConditionIds ?? []);
  const depthLimit = Math.max(1, Math.min(5, options.depthLimit ?? 3));
  const maxPaths = Math.max(1, Math.min(8, options.maxPaths ?? 5));

  const valuesSI = new Map<string, number>();
  for (const [quantityId, input] of options.values ?? []) {
    const quantity = quantities.get(quantityId);
    const unit = units.get(input.unitId);
    if (!quantity || !unit || unit.dimensionId !== quantity.dimensionId) continue;
    if (!Number.isFinite(input.value)) continue;
    valuesSI.set(quantityId, toSI(input.value, unit));
  }

  const candidateCache = new Map<string, Array<{ equation: Equation; ast: AstNode; preconditions: SolvePrecondition[] }>>();
  const candidatesFor = (
    quantityId: string,
  ): Array<{ equation: Equation; ast: AstNode; preconditions: SolvePrecondition[] }> => {
    const cached = candidateCache.get(quantityId);
    if (cached) return cached;
    const found: Array<{ equation: Equation; ast: AstNode; preconditions: SolvePrecondition[] }> = [];
    for (const equation of kb.equations) {
      const solved = solveFor(equation, quantityId, quantities);
      if (solved.ok) {
        found.push({ equation, ast: solved.ast, preconditions: solved.preconditions });
      }
    }
    const explicit = (equation: Equation): number => {
      const lhsVariable = equation.lhsAst.type === 'variable' ? equation.lhsAst.quantityId : null;
      const rhsVariable = equation.rhsAst.type === 'variable' ? equation.rhsAst.quantityId : null;
      return lhsVariable === quantityId || rhsVariable === quantityId ? 0 : 1;
    };
    found.sort((left, right) => {
      const explicitDifference = explicit(left.equation) - explicit(right.equation);
      if (explicitDifference !== 0) return explicitDifference;
      const leftVariables =
        quantityVariables(left.equation.lhsAst).length + quantityVariables(left.equation.rhsAst).length;
      const rightVariables =
        quantityVariables(right.equation.lhsAst).length + quantityVariables(right.equation.rhsAst).length;
      if (leftVariables !== rightVariables) return leftVariables - rightVariables;
      return left.equation.id.localeCompare(right.equation.id);
    });
    candidateCache.set(quantityId, found);
    return found;
  };

  const tryCandidate = (
    candidate: { equation: Equation; ast: AstNode; preconditions: SolvePrecondition[] },
    quantityId: string,
    available: Set<string>,
    depth: number,
    visited: Set<string>,
  ): RawChain | null => {
    if (depth <= 0) return null;
    const unknown = quantityVariables(candidate.ast).filter(
      (variableId) => variableId !== quantityId && !available.has(variableId),
    );
    const steps: RawStep[] = [];
    const conditionIds: string[] = [];
    const unverifiedConstraints: string[] = [];
    const notes: string[] = [];
    const availableExtended = new Set(available);
    const nextVisited = new Set(visited);
    nextVisited.add(quantityId);

    for (const unknownId of unknown) {
      if (nextVisited.has(unknownId)) return null;
      const sub = resolve(unknownId, availableExtended, depth - 1, nextVisited);
      if (!sub) return null;
      steps.push(...sub.steps);
      conditionIds.push(...sub.conditionIds);
      unverifiedConstraints.push(...sub.unverifiedConstraints);
      notes.push(...sub.notes);
      availableExtended.add(unknownId);
    }

    notes.push(...equationNotes(candidate.equation, kb));
    conditionIds.push(...candidate.equation.conditionRefs);
    for (const precondition of candidate.preconditions) {
      const mapped = mapPrecondition(precondition, kb);
      if ('conditionId' in mapped) conditionIds.push(mapped.conditionId);
      else unverifiedConstraints.push(mapped.constraint);
    }

    steps.push({
      equation: candidate.equation,
      targetId: quantityId,
      ast: candidate.ast,
      preconditions: candidate.preconditions,
    });

    return {
      steps,
      conditionIds: [...new Set(conditionIds)],
      unverifiedConstraints: [...new Set(unverifiedConstraints)],
      notes: [...new Set(notes)],
    };
  };

  const resolve = (
    quantityId: string,
    available: Set<string>,
    depth: number,
    visited: Set<string>,
  ): RawChain | null => {
    if (available.has(quantityId)) {
      return { steps: [], conditionIds: [], unverifiedConstraints: [], notes: [] };
    }
    if (depth <= 0) return null;
    if (visited.has(quantityId)) return null;
    for (const candidate of candidatesFor(quantityId)) {
      const chain = tryCandidate(candidate, quantityId, available, depth, visited);
      if (chain) return chain;
    }
    return null;
  };

  const reviewFor = (steps: RawStep[]): PathReview => {
    const perEquation: PathReview['perEquation'] = [];
    const seen = new Set<string>();
    for (const step of steps) {
      if (seen.has(step.equation.id)) continue;
      seen.add(step.equation.id);
      perEquation.push({
        equationId: step.equation.id,
        formulation: step.equation.review.formulation,
        expert: step.equation.review.expert,
      });
    }
    const formulations = new Set(perEquation.map((item) => item.formulation));
    const formulation: FormulationSummary =
      formulations.size === 1 ? [...formulations][0] : 'mixed';
    const severity: Record<ExpertReviewStatus, number> = {
      rejected: 3,
      requested: 2,
      none: 1,
      completed: 0,
    };
    let expert: ExpertReviewStatus = perEquation.length === 0 ? 'none' : 'completed';
    for (const item of perEquation) {
      if (severity[item.expert] > severity[expert]) expert = item.expert;
    }
    return { formulation, expert, perEquation };
  };

  const buildPath = (chain: RawChain): PathResult => {
    const evaluationValues = new Map(valuesSI);
    const steps: PathStep[] = [];
    let evaluationFailed = false;
    const evaluationMessages: string[] = [];

    for (const step of chain.steps) {
      let computed: PathStep['computed'] = null;
      const inputs = quantityVariables(step.ast);
      const allAvailable = inputs.every(
        (variableId) => variableId === step.targetId || evaluationValues.has(variableId),
      );
      if (allAvailable) {
        try {
          const siValue = evaluate(step.ast, evaluationValues);
          evaluationValues.set(step.targetId, siValue);
          const quantity = quantities.get(step.targetId);
          const unitId =
            step.targetId === options.targetId
              ? (options.targetUnitId ?? quantity?.preferredUnitId)
              : quantity?.preferredUnitId;
          const unit = unitId ? units.get(unitId) : undefined;
          if (unit) {
            computed = { siValue, value: fromSI(siValue, unit), unitId: unit.id };
          } else {
            computed = null;
          }
        } catch (error) {
          evaluationFailed = true;
          evaluationMessages.push(
            error instanceof EvaluationError
              ? `Численный расчёт остановлен: ${error.message}`
              : 'Численный расчёт остановлен из-за ошибки.',
          );
        }
      }
      steps.push({
        equation: step.equation,
        targetId: step.targetId,
        ast: step.ast,
        preconditions: step.preconditions,
        computed,
      });
    }

    const requiredBy = new Map<string, Set<string>>();
    const addRequiredBy = (conditionId: string, equationId: string): void => {
      const set = requiredBy.get(conditionId) ?? new Set<string>();
      set.add(equationId);
      requiredBy.set(conditionId, set);
    };
    for (const step of chain.steps) {
      for (const conditionId of step.equation.conditionRefs) {
        addRequiredBy(conditionId, step.equation.id);
      }
      for (const precondition of step.preconditions) {
        const mapped = mapPrecondition(precondition, kb);
        if ('conditionId' in mapped) addRequiredBy(mapped.conditionId, step.equation.id);
      }
    }

    const conditions: PathCondition[] = [];
    for (const conditionId of chain.conditionIds) {
      const condition = kb.conditions.find((item) => item.id === conditionId);
      if (!condition) continue;
      let status: PathCondition['status'] = violated.has(conditionId)
        ? 'violated'
        : confirmed.has(conditionId)
          ? 'confirmed'
          : 'unconfirmed';
      if (status !== 'violated' && condition.structured?.type === 'nonzero') {
        const quantityId = condition.structured.quantityId;
        if (quantityId && evaluationValues.get(quantityId) === 0) status = 'violated';
      }
      conditions.push({
        condition,
        status,
        requiredBy: [...(requiredBy.get(conditionId) ?? [])].sort(),
      });
    }

    const hasViolated = conditions.some((condition) => condition.status === 'violated');
    const confirmedCount = conditions.filter((condition) => condition.status === 'confirmed').length;
    const conditionsStatus: PathConditionsStatus =
      conditions.length === 0 && chain.unverifiedConstraints.length === 0
        ? 'not-required'
        : hasViolated
          ? 'violated'
          : chain.unverifiedConstraints.length > 0
            ? confirmedCount > 0
              ? 'partial'
              : 'unconfirmed'
            : confirmedCount === conditions.length
              ? 'confirmed'
              : confirmedCount > 0
                ? 'partial'
                : 'unconfirmed';

    const computationStatus: ComputationStatus = evaluationFailed
      ? 'failed'
      : steps.length > 0 && steps.every((step) => step.computed !== null)
        ? 'numeric'
        : 'symbolic';

    return {
      id: `${options.targetId}:${chain.steps.map((step) => `${step.equation.id}>${step.targetId}`).join('|')}`,
      targetId: options.targetId,
      computation: { status: computationStatus, messages: evaluationMessages },
      conditionsStatus,
      review: reviewFor(chain.steps),
      steps,
      conditions,
      unverifiedConstraints: chain.unverifiedConstraints,
      notes: chain.notes,
      knownIds: [...known],
    };
  };

  if (known.has(options.targetId)) {
    return {
      target,
      paths: [
        {
          id: `${options.targetId}:known`,
          targetId: options.targetId,
          computation: { status: 'symbolic', messages: [] },
          conditionsStatus: 'not-required',
          review: { formulation: 'mixed', expert: 'none', perEquation: [] },
          steps: [],
          conditions: [],
          unverifiedConstraints: [],
          notes: ['Целевая величина уже среди известных.'],
          knownIds: [...known],
        },
      ],
      reason: null,
    };
  }

  const paths: PathResult[] = [];
  const signatures = new Set<string>();
  for (const candidate of candidatesFor(options.targetId).slice(0, 10)) {
    const chain = tryCandidate(candidate, options.targetId, known, depthLimit, new Set());
    if (!chain) continue;
    const path = buildPath(chain);
    if (signatures.has(path.id)) continue;
    signatures.add(path.id);
    paths.push(path);
  }

  const conditionWeight = (path: PathResult): number => {
    if (path.conditionsStatus === 'violated') return 3;
    if (path.conditionsStatus === 'unconfirmed') return 2;
    if (path.conditionsStatus === 'partial') return 1;
    return 0;
  };
  const computationWeight = (path: PathResult): number =>
    path.computation.status === 'failed' ? 2 : path.computation.status === 'symbolic' ? 1 : 0;
  paths.sort((left, right) => {
    if (computationWeight(left) !== computationWeight(right)) {
      return computationWeight(left) - computationWeight(right);
    }
    if (conditionWeight(left) !== conditionWeight(right)) {
      return conditionWeight(left) - conditionWeight(right);
    }
    const leftUnconfirmed = left.conditions.filter((condition) => condition.status === 'unconfirmed').length;
    const rightUnconfirmed = right.conditions.filter((condition) => condition.status === 'unconfirmed').length;
    if (leftUnconfirmed !== rightUnconfirmed) return leftUnconfirmed - rightUnconfirmed;
    if (left.steps.length !== right.steps.length) return left.steps.length - right.steps.length;
    return left.id.localeCompare(right.id);
  });

  const reason =
    paths.length > 0
      ? null
      : candidatesFor(options.targetId).length === 0
        ? `Нет уравнения, из которого выражается величина «${target.symbol}».`
        : `Не удалось построить цепочку к «${target.symbol}» из заданных величин при глубине ${depthLimit}. Проверьте состав известных величин или увеличьте глубину поиска.`;

  return { target, paths: paths.slice(0, maxPaths), reason };
}

export interface PathHighlight {
  nodes: string[];
  edges: string[];
}

export function pathHighlight(path: PathResult): PathHighlight {
  const nodes = new Set<string>([path.targetId]);
  const edges = new Set<string>();
  for (const step of path.steps) {
    nodes.add(step.equation.id);
    nodes.add(step.targetId);
    edges.add(`appears_in:${step.targetId}->${step.equation.id}`);
    for (const variableId of quantityVariables(step.ast)) {
      nodes.add(variableId);
      edges.add(`appears_in:${variableId}->${step.equation.id}`);
    }
    for (const condition of step.equation.conditionRefs) {
      nodes.add(condition);
      edges.add(`requires_condition:${step.equation.id}->${condition}`);
    }
  }
  return { nodes: [...nodes], edges: [...edges] };
}