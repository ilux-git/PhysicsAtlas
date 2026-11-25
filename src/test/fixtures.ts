import type {
  Condition,
  Derivation,
  Dimension,
  DimensionVector,
  DomainRecord,
  Equation,
  KnowledgeInput,
  Law,
  Quantity,
  SourceRecord,
  Unit,
} from '../domain/types.ts';

function vector(L = 0, M = 0, T = 0, I = 0, Th = 0, N = 0, J = 0): DimensionVector {
  return { L, M, T, I, Th, N, J };
}

const base = (id: string, name: string) => ({
  id,
  slug: id.replace(/^[a-z]+\./, ''),
  name: { ru: name },
  aliases: [],
  description: { ru: name },
  levelPresentations: {},
  domains: ['domain.mechanics'],
  sources: ['source.test'],
  review: { formulation: 'standard-school', expert: 'none' } as const,
});

export function makeValidInput(): KnowledgeInput {
  const dimensions: Dimension[] = [
    { ...base('dim.length', 'Длина'), kind: 'dimension', exponents: vector(1) },
    { ...base('dim.time', 'Время'), kind: 'dimension', exponents: vector(0, 0, 1) },
    { ...base('dim.velocity', 'Скорость'), kind: 'dimension', exponents: vector(1, 0, -1) },
  ];

  const units: Unit[] = [
    {
      ...base('unit.meter', 'метр'),
      kind: 'unit',
      symbol: 'm',
      dimensionId: 'dim.length',
      system: 'SI',
      factor: 1,
      offset: 0,
      conversionGroup: 'length',
    },
    {
      ...base('unit.kilometer', 'километр'),
      kind: 'unit',
      symbol: 'km',
      dimensionId: 'dim.length',
      system: 'non-SI',
      factor: 1000,
      offset: 0,
      conversionGroup: 'length',
    },
    {
      ...base('unit.second', 'секунда'),
      kind: 'unit',
      symbol: 's',
      dimensionId: 'dim.time',
      system: 'SI',
      factor: 1,
      offset: 0,
      conversionGroup: 'time',
    },
    {
      ...base('unit.meter-per-second', 'метр в секунду'),
      kind: 'unit',
      symbol: 'm/s',
      dimensionId: 'dim.velocity',
      system: 'SI',
      factor: 1,
      offset: 0,
      conversionGroup: 'velocity',
    },
  ];

  const quantities: Quantity[] = [
    {
      ...base('q.distance', 'Расстояние (фикстура)'),
      kind: 'quantity',
      symbol: 's',
      quantityKind: 'vector',
      dimensionId: 'dim.length',
      unitIds: ['unit.meter', 'unit.kilometer'],
      preferredUnitId: 'unit.meter',
      definition: { ru: 'Тестовая величина длины.' },
    },
    {
      ...base('q.time', 'Время (фикстура)'),
      kind: 'quantity',
      symbol: 't',
      quantityKind: 'scalar',
      dimensionId: 'dim.time',
      unitIds: ['unit.second'],
      preferredUnitId: 'unit.second',
      definition: { ru: 'Тестовая величина времени.' },
    },
    {
      ...base('q.speed', 'Скорость (фикстура)'),
      kind: 'quantity',
      symbol: 'v',
      quantityKind: 'vector',
      dimensionId: 'dim.velocity',
      unitIds: ['unit.meter-per-second'],
      preferredUnitId: 'unit.meter-per-second',
      definition: { ru: 'Тестовая величина скорости.' },
    },
  ];

  const conditions: Condition[] = [
    {
      ...base('cond.nonzero-time', 'Время не равно нулю'),
      kind: 'condition',
      structured: { type: 'nonzero', quantityId: 'q.time' },
    },
    {
      ...base('cond.nonzero-speed', 'Скорость не равна нулю'),
      kind: 'condition',
      structured: { type: 'nonzero', quantityId: 'q.speed' },
    },
  ];

  const laws: Law[] = [
    {
      ...base('law.motion', 'Закон движения (фикстура)'),
      kind: 'law',
      conditionRefs: ['cond.nonzero-time'],
    },
  ];

  const equations: Equation[] = [
    {
      ...base('eq.speed', 'Скорость равномерного движения (фикстура)'),
      kind: 'equation',
      lhsAst: { type: 'variable', quantityId: 'q.speed' },
      rhsAst: {
        type: 'divide',
        left: { type: 'variable', quantityId: 'q.distance' },
        right: { type: 'variable', quantityId: 'q.time' },
      },
      displayLatex: 'v = \\frac{s}{t}',
      alternativeForms: [],
      lawRefs: ['law.motion'],
      conditionRefs: ['cond.nonzero-time'],
      form: { kind: 'magnitudes' },
      conditionsStatus: 'explicit',
    },
    {
      ...base('eq.time', 'Время из скорости (фикстура)'),
      kind: 'equation',
      lhsAst: { type: 'variable', quantityId: 'q.time' },
      rhsAst: {
        type: 'divide',
        left: { type: 'variable', quantityId: 'q.distance' },
        right: { type: 'variable', quantityId: 'q.speed' },
      },
      displayLatex: 't = \\frac{s}{v}',
      alternativeForms: [],
      lawRefs: [],
      conditionRefs: ['cond.nonzero-speed'],
      form: { kind: 'magnitudes' },
      conditionsStatus: 'explicit',
    },
  ];

  const derivations: Derivation[] = [
    {
      ...base('der.speed.time', 'Вывод t = s/v'),
      kind: 'derivation',
      sourceEquationId: 'eq.speed',
      targetEquationId: 'eq.time',
      steps: [
        {
          order: 1,
          description: 'Умножим обе части на t.',
          operation: 'multiply-both-sides',
          displayFrom: 'v = s/t',
          displayTo: 'v t = s',
          precondition: 't ≠ 0',
        },
        {
          order: 2,
          description: 'Разделим обе части на v.',
          operation: 'divide-both-sides',
          displayFrom: 'v t = s',
          displayTo: 't = s/v',
          precondition: 'v ≠ 0',
        },
      ],
      preconditions: ['cond.nonzero-time', 'cond.nonzero-speed'],
      verificationStatus: 'structural',
    },
  ];

  const domains: DomainRecord[] = [
    { id: 'domain.mechanics', slug: 'mechanics', name: { ru: 'Механика' } },
  ];

  const sources: SourceRecord[] = [
    { id: 'source.test', type: 'reference', title: 'Тестовая фикстура' },
  ];

  return { dimensions, units, quantities, laws, conditions, equations, derivations, domains, sources };
}