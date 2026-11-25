import { knowledgeFileSchemas, type RawKnowledgeFiles } from '../domain/schemas.ts';
import type {
  Diagnostic,
  Entity,
  KnowledgeBase,
  KnowledgeInput,
} from '../domain/types.ts';
import { deriveEdges } from './derive.ts';
import { rawKnowledge } from './raw.ts';
import { validateEdges, validateKnowledge } from './validate.ts';

export interface BuildResult {
  kb: KnowledgeBase | null;
  diagnostics: Diagnostic[];
}

function pushIssues(
  error: { issues: ReadonlyArray<{ path: PropertyKey[]; message: string }> },
  file: string,
  diagnostics: Diagnostic[],
): void {
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? `[${issue.path.join('.')}]` : '';
    diagnostics.push({
      severity: 'error',
      code: 'schema-invalid',
      entityId: file,
      message: `${file}${path}: ${issue.message}`,
    });
  }
}

export function buildKnowledgeBase(input: KnowledgeInput): BuildResult {
  const diagnostics = validateKnowledge(input);

  const entities = new Map<string, Entity>();
  const everything: Entity[] = [
    ...input.quantities,
    ...input.equations,
    ...input.laws,
    ...input.units,
    ...input.dimensions,
    ...input.conditions,
    ...input.derivations,
  ];
  for (const entity of everything) {
    if (!entities.has(entity.id)) entities.set(entity.id, entity);
  }

  const edges = deriveEdges(input);
  diagnostics.push(...validateEdges(edges, entities));

  const kb: KnowledgeBase = {
    entities,
    quantities: input.quantities,
    equations: input.equations,
    laws: input.laws,
    units: input.units,
    dimensions: input.dimensions,
    conditions: input.conditions,
    derivations: input.derivations,
    domains: input.domains,
    sources: input.sources,
    edges,
    diagnostics,
  };

  return { kb, diagnostics };
}

export function loadKnowledgeBase(raw: RawKnowledgeFiles = rawKnowledge): BuildResult {
  const diagnostics: Diagnostic[] = [];

  const dimensions = knowledgeFileSchemas.dimensions.safeParse(raw.dimensions);
  if (!dimensions.success) pushIssues(dimensions.error, 'dimensions', diagnostics);
  const units = knowledgeFileSchemas.units.safeParse(raw.units);
  if (!units.success) pushIssues(units.error, 'units', diagnostics);
  const quantities = knowledgeFileSchemas.quantities.safeParse(raw.quantities);
  if (!quantities.success) pushIssues(quantities.error, 'quantities', diagnostics);
  const laws = knowledgeFileSchemas.laws.safeParse(raw.laws);
  if (!laws.success) pushIssues(laws.error, 'laws', diagnostics);
  const conditions = knowledgeFileSchemas.conditions.safeParse(raw.conditions);
  if (!conditions.success) pushIssues(conditions.error, 'conditions', diagnostics);
  const equations = knowledgeFileSchemas.equations.safeParse(raw.equations);
  if (!equations.success) pushIssues(equations.error, 'equations', diagnostics);
  const derivations = knowledgeFileSchemas.derivations.safeParse(raw.derivations);
  if (!derivations.success) pushIssues(derivations.error, 'derivations', diagnostics);
  const domains = knowledgeFileSchemas.domains.safeParse(raw.domains);
  if (!domains.success) pushIssues(domains.error, 'domains', diagnostics);
  const sources = knowledgeFileSchemas.sources.safeParse(raw.sources);
  if (!sources.success) pushIssues(sources.error, 'sources', diagnostics);

  if (
    !dimensions.success ||
    !units.success ||
    !quantities.success ||
    !laws.success ||
    !conditions.success ||
    !equations.success ||
    !derivations.success ||
    !domains.success ||
    !sources.success
  ) {
    return { kb: null, diagnostics };
  }

  const input: KnowledgeInput = {
    dimensions: dimensions.data,
    units: units.data,
    quantities: quantities.data,
    laws: laws.data,
    conditions: conditions.data,
    equations: equations.data,
    derivations: derivations.data,
    domains: domains.data,
    sources: sources.data,
  };

  const built = buildKnowledgeBase(input);
  return { kb: built.kb, diagnostics: [...diagnostics, ...built.diagnostics] };
}

export function errorDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === 'error');
}

export function warningDiagnostics(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return diagnostics.filter((diagnostic) => diagnostic.severity === 'warning');
}

export type { RawKnowledgeFiles };