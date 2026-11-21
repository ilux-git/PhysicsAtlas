import type { EdgeKind, Entity, EntityKind, LevelKey, ReviewStatus } from '../domain/types.ts';
import { LEVEL_LABELS } from '../domain/types.ts';
import { formatDimension } from '../engines/dimensions.ts';

export const ENTITY_KIND_LABELS: Record<EntityKind, string> = {
  quantity: 'Величина',
  equation: 'Уравнение',
  law: 'Закон',
  unit: 'Единица',
  dimension: 'Размерность',
  condition: 'Условие',
  derivation: 'Вывод',
};

export const ENTITY_KIND_GLYPH: Record<EntityKind, string> = {
  quantity: '●',
  equation: '=',
  law: '§',
  unit: '▪',
  dimension: '△',
  condition: '!',
  derivation: '⇒',
};

export const ENTITY_KIND_ORDER: readonly EntityKind[] = [
  'quantity',
  'equation',
  'law',
  'unit',
  'dimension',
  'condition',
  'derivation',
];

export const EDGE_KIND_LABELS: Record<EdgeKind, string> = {
  appears_in: 'входит в уравнение',
  expresses: 'выражает закон',
  derived_from: 'выведено из',
  has_unit: 'имеет единицу',
  has_dimension: 'имеет размерность',
  equivalent_unit: 'переводимая единица',
  requires_condition: 'требует условия',
  related_to: 'связано с',
  has_derivation: 'имеет вывод',
  produces: 'порождает уравнение',
};

export const EDGE_KIND_GROUP: Record<EdgeKind, 'physical' | 'mathematical' | 'structural'> = {
  appears_in: 'mathematical',
  expresses: 'physical',
  derived_from: 'mathematical',
  has_unit: 'structural',
  has_dimension: 'structural',
  equivalent_unit: 'structural',
  requires_condition: 'physical',
  related_to: 'physical',
  has_derivation: 'mathematical',
  produces: 'mathematical',
};

export const REVIEW_LABELS: Record<ReviewStatus, string> = {
  'standard-form': 'стандартная школьная формулировка',
  draft: 'черновик',
  'needs-review': 'требует проверки',
};

export function levelLabel(level: LevelKey): string {
  return LEVEL_LABELS[level];
}

export function formatNumber(value: number): string {
  if (!Number.isFinite(value)) return String(value);
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute < 0.001 || absolute >= 1e7)) {
    return value.toExponential(3).replace('.', ',');
  }
  return new Intl.NumberFormat('ru-RU', {
    maximumFractionDigits: 6,
    minimumFractionDigits: 0,
  }).format(value);
}

export function latexToPlain(latex: string): string {
  return latex
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1) / ($2)')
    .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
    .replace(/\\cdot/g, '·')
    .replace(/\\times/g, '×')
    .replace(/\\[a-zA-Z]+/g, '')
    .replace(/[{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function entityShortLabel(entity: Entity): string {
  switch (entity.kind) {
    case 'quantity':
    case 'unit':
      return entity.symbol;
    case 'dimension':
      return formatDimension(entity.exponents);
    case 'equation':
      return latexToPlain(entity.displayLatex).slice(0, 26);
    case 'law':
      return entity.name.ru.replace('Второй закон Ньютона', 'II закон Ньютона').slice(0, 22);
    case 'condition':
      return entity.name.ru.slice(0, 22);
    case 'derivation':
      return entity.name.ru.slice(0, 24);
  }
}

export function entityDisplayName(entity: Entity): string {
  return entity.name.ru;
}

export function edgeKindLabel(kind: EdgeKind): string {
  return EDGE_KIND_LABELS[kind];
}