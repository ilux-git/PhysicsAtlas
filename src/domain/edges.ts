import type { EdgeKind, EntityKind } from './types.ts';

export interface EdgeContract {
  from: readonly EntityKind[];
  to: readonly EntityKind[];
  origin: 'derived' | 'authored' | 'both';
  label: string;
  direction: string;
}

const ALL_KINDS: readonly EntityKind[] = [
  'quantity',
  'equation',
  'law',
  'unit',
  'dimension',
  'condition',
  'derivation',
];

export const EDGE_REGISTRY: Record<EdgeKind, EdgeContract> = {
  appears_in: {
    from: ['quantity'],
    to: ['equation'],
    origin: 'derived',
    label: 'входит в уравнение',
    direction: 'величина → уравнение',
  },
  expresses: {
    from: ['equation'],
    to: ['law'],
    origin: 'derived',
    label: 'выражает закон',
    direction: 'уравнение → закон',
  },
  derived_from: {
    from: ['equation'],
    to: ['equation'],
    origin: 'derived',
    label: 'выведено из',
    direction: 'целевое уравнение → исходное уравнение',
  },
  has_unit: {
    from: ['quantity'],
    to: ['unit'],
    origin: 'derived',
    label: 'имеет единицу',
    direction: 'величина → единица',
  },
  has_dimension: {
    from: ['quantity'],
    to: ['dimension'],
    origin: 'derived',
    label: 'имеет размерность',
    direction: 'величина → размерность',
  },
  equivalent_unit: {
    from: ['unit'],
    to: ['unit'],
    origin: 'derived',
    label: 'переводимая единица',
    direction: 'единица → единица (направленный перевод)',
  },
  requires_condition: {
    from: ['equation', 'law'],
    to: ['condition'],
    origin: 'derived',
    label: 'требует условия',
    direction: 'уравнение/закон → условие',
  },
  related_to: {
    from: ALL_KINDS,
    to: ALL_KINDS,
    origin: 'authored',
    label: 'связано с',
    direction: 'любая сущность → любая сущность',
  },
  has_derivation: {
    from: ['equation'],
    to: ['derivation'],
    origin: 'derived',
    label: 'имеет вывод',
    direction: 'исходное уравнение → вывод',
  },
  produces: {
    from: ['derivation'],
    to: ['equation'],
    origin: 'derived',
    label: 'порождает уравнение',
    direction: 'вывод → целевое уравнение',
  },
};