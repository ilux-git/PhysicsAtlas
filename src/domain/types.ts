export type LevelKey = '7-8' | '9' | '10-11';

export const LEVEL_KEYS: readonly LevelKey[] = ['7-8', '9', '10-11'];

export const LEVEL_LABELS: Record<LevelKey, string> = {
  '7-8': '7–8 класс',
  '9': '9 класс',
  '10-11': '10–11 класс',
};

export interface LocalizedText {
  ru: string;
  en?: string;
}

export function localized(text: LocalizedText, locale: 'ru' | 'en' = 'ru'): string {
  return locale === 'en' ? (text.en ?? text.ru) : text.ru;
}

export interface LevelPresentation {
  summary: LocalizedText;
  details?: LocalizedText;
  mathNote?: LocalizedText;
  extraLinks?: Array<{ label: LocalizedText; targetId: string }>;
}

export type LevelPresentations = Partial<Record<LevelKey, LevelPresentation>>;

export type ReviewStatus = 'standard-form' | 'draft' | 'needs-review';

export interface Review {
  status: ReviewStatus;
  note?: LocalizedText;
}

export type EntityKind = 'quantity' | 'equation' | 'law' | 'unit' | 'dimension' | 'condition' | 'derivation';

export interface EntityBase {
  id: string;
  slug: string;
  name: LocalizedText;
  aliases: LocalizedText[];
  description: LocalizedText;
  levelPresentations: LevelPresentations;
  domains: string[];
  sources: string[];
  review: Review;
}

export type QuantityKind = 'scalar' | 'vector';

export interface Quantity extends EntityBase {
  kind: 'quantity';
  symbol: string;
  quantityKind: QuantityKind;
  dimensionId: string;
  unitIds: string[];
  preferredUnitId: string;
  definition: LocalizedText;
}

export interface EquationForm {
  kind: 'magnitudes' | 'vectors';
  note?: LocalizedText;
}

export interface AlternativeForm {
  id: string;
  note: LocalizedText;
  lhsAst: AstNode;
  rhsAst: AstNode;
  displayLatex: string;
}

export type ConditionsStatus = 'explicit' | 'missing';

export interface Equation extends EntityBase {
  kind: 'equation';
  lhsAst: AstNode;
  rhsAst: AstNode;
  displayLatex: string;
  alternativeForms: AlternativeForm[];
  lawRefs: string[];
  conditionRefs: string[];
  form: EquationForm;
  physicalReview: ReviewStatus;
  conditionsStatus: ConditionsStatus;
}

export interface Law extends EntityBase {
  kind: 'law';
  conditionRefs: string[];
}

export interface StructuredConstraint {
  type: 'frame' | 'constancy' | 'direction' | 'nonzero' | 'material' | 'regime';
  quantityId?: string;
  value?: string;
  note?: LocalizedText;
}

export interface Condition extends EntityBase {
  kind: 'condition';
  structured?: StructuredConstraint;
}

export interface DerivationStep {
  order: number;
  description: string;
  operation: 'divide-both-sides' | 'multiply-both-sides' | 'solve-for' | 'rewrite' | 'substitute';
  displayFrom: string;
  displayTo: string;
  precondition?: string;
}

export type DerivationVerification = 'draft' | 'structural' | 'verified';

export interface Derivation extends EntityBase {
  kind: 'derivation';
  sourceEquationId: string;
  targetEquationId: string;
  steps: DerivationStep[];
  preconditions: string[];
  verificationStatus: DerivationVerification;
}

export interface Unit extends EntityBase {
  kind: 'unit';
  symbol: string;
  dimensionId: string;
  system: 'SI' | 'non-SI' | 'accepted';
  factor: number;
  offset: number;
  conversionGroup: string;
}

export type BaseDimension = 'L' | 'M' | 'T' | 'I' | 'Th' | 'N' | 'J';

export type DimensionVector = Record<BaseDimension, number>;

export const BASE_DIMENSIONS: readonly BaseDimension[] = ['L', 'M', 'T', 'I', 'Th', 'N', 'J'];

export interface Dimension extends EntityBase {
  kind: 'dimension';
  exponents: DimensionVector;
}

export interface DomainRecord {
  id: string;
  slug: string;
  name: LocalizedText;
  description?: LocalizedText;
}

export type SourceType = 'standard' | 'textbook' | 'curriculum' | 'reference';

export interface SourceRecord {
  id: string;
  type: SourceType;
  title: string;
  authors?: string;
  edition?: string;
  url?: string;
  note?: LocalizedText;
}

export type AstNode =
  | { type: 'variable'; quantityId: string }
  | { type: 'constant'; name: string; value: number; display?: string }
  | { type: 'add' | 'subtract' | 'multiply' | 'divide'; left: AstNode; right: AstNode }
  | { type: 'power'; base: AstNode; exponent: number }
  | { type: 'sqrt'; arg: AstNode }
  | { type: 'negate'; arg: AstNode };

export type Entity = Quantity | Equation | Law | Unit | Dimension | Condition | Derivation;

export type EdgeKind =
  | 'appears_in'
  | 'expresses'
  | 'derived_from'
  | 'has_unit'
  | 'has_dimension'
  | 'equivalent_unit'
  | 'requires_condition'
  | 'related_to'
  | 'has_derivation'
  | 'produces';

export interface Edge {
  id: string;
  kind: EdgeKind;
  from: string;
  to: string;
  origin: 'derived' | 'authored';
  note?: string;
}

export type DiagnosticSeverity = 'error' | 'warning';

export interface Diagnostic {
  severity: DiagnosticSeverity;
  code: string;
  message: string;
  entityId?: string;
}

export interface KnowledgeInput {
  quantities: Quantity[];
  equations: Equation[];
  laws: Law[];
  units: Unit[];
  dimensions: Dimension[];
  conditions: Condition[];
  derivations: Derivation[];
  domains: DomainRecord[];
  sources: SourceRecord[];
}

export interface KnowledgeBase {
  entities: ReadonlyMap<string, Entity>;
  quantities: readonly Quantity[];
  equations: readonly Equation[];
  laws: readonly Law[];
  units: readonly Unit[];
  dimensions: readonly Dimension[];
  conditions: readonly Condition[];
  derivations: readonly Derivation[];
  domains: readonly DomainRecord[];
  sources: readonly SourceRecord[];
  edges: readonly Edge[];
  diagnostics: readonly Diagnostic[];
}

export function isQuantity(entity: Entity): entity is Quantity {
  return entity.kind === 'quantity';
}

export function isEquation(entity: Entity): entity is Equation {
  return entity.kind === 'equation';
}

export function isLaw(entity: Entity): entity is Law {
  return entity.kind === 'law';
}

export function isUnit(entity: Entity): entity is Unit {
  return entity.kind === 'unit';
}

export function isDimension(entity: Entity): entity is Dimension {
  return entity.kind === 'dimension';
}

export function isCondition(entity: Entity): entity is Condition {
  return entity.kind === 'condition';
}

export function isDerivation(entity: Entity): entity is Derivation {
  return entity.kind === 'derivation';
}