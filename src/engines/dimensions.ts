import type { AstNode, BaseDimension, DimensionVector, KnowledgeBase } from '../domain/types.ts';
import { BASE_DIMENSIONS } from '../domain/types.ts';

export type DimensionErrorCode =
  | 'unknown-quantity'
  | 'add-mismatch'
  | 'sqrt-odd-exponent'
  | 'power-not-integer'
  | 'invalid-ast';

export class DimensionError extends Error {
  readonly code: DimensionErrorCode;

  constructor(code: DimensionErrorCode, message: string) {
    super(message);
    this.name = 'DimensionError';
    this.code = code;
  }
}

export function zeroDimension(): DimensionVector {
  return { L: 0, M: 0, T: 0, I: 0, Th: 0, N: 0, J: 0 };
}

export function dimensionVector(partial: Partial<DimensionVector>): DimensionVector {
  return { ...zeroDimension(), ...partial };
}

const SUPERSCRIPTS: Record<string, string> = {
  '0': '⁰',
  '1': '¹',
  '2': '²',
  '3': '³',
  '4': '⁴',
  '5': '⁵',
  '6': '⁶',
  '7': '⁷',
  '8': '⁸',
  '9': '⁹',
  '-': '⁻',
};

export function superscript(value: number): string {
  return String(value)
    .split('')
    .map((character) => SUPERSCRIPTS[character] ?? character)
    .join('');
}

const SYMBOLS: Record<BaseDimension, string> = {
  L: 'L',
  M: 'M',
  T: 'T',
  I: 'I',
  Th: 'Θ',
  N: 'N',
  J: 'J',
};

export function formatDimension(dimension: DimensionVector): string {
  const parts: string[] = [];
  for (const base of BASE_DIMENSIONS) {
    const exponent = dimension[base];
    if (exponent === 0) continue;
    parts.push(exponent === 1 ? SYMBOLS[base] : `${SYMBOLS[base]}${superscript(exponent)}`);
  }
  return parts.length === 0 ? '1 (безразмерная)' : parts.join('·');
}

export function multiplyDimensions(
  left: DimensionVector,
  right: DimensionVector,
): DimensionVector {
  const result = zeroDimension();
  for (const base of BASE_DIMENSIONS) {
    result[base] = left[base] + right[base];
  }
  return result;
}

export function divideDimensions(
  numerator: DimensionVector,
  denominator: DimensionVector,
): DimensionVector {
  const result = zeroDimension();
  for (const base of BASE_DIMENSIONS) {
    result[base] = numerator[base] - denominator[base];
  }
  return result;
}

export function powerDimension(dimension: DimensionVector, exponent: number): DimensionVector {
  const result = zeroDimension();
  for (const base of BASE_DIMENSIONS) {
    result[base] = dimension[base] * exponent;
  }
  return result;
}

export function sqrtDimension(dimension: DimensionVector): DimensionVector {
  const result = zeroDimension();
  for (const base of BASE_DIMENSIONS) {
    if (dimension[base] % 2 !== 0) {
      throw new DimensionError(
        'sqrt-odd-exponent',
        `Извлечение корня из размерности ${formatDimension(dimension)} даёт дробный показатель; такой корень не определён в модели.`,
      );
    }
    result[base] = dimension[base] / 2;
  }
  return result;
}

export function dimensionsEqual(left: DimensionVector, right: DimensionVector): boolean {
  return BASE_DIMENSIONS.every((base) => left[base] === right[base]);
}

export function dimensionOf(
  node: AstNode,
  quantityDimensions: ReadonlyMap<string, DimensionVector>,
): DimensionVector {
  switch (node.type) {
    case 'variable': {
      const dimension = quantityDimensions.get(node.quantityId);
      if (!dimension) {
        throw new DimensionError(
          'unknown-quantity',
          `Величина «${node.quantityId}» не имеет известной размерности.`,
        );
      }
      return dimension;
    }
    case 'constant':
      return zeroDimension();
    case 'negate':
    case 'sqrt':
      return node.type === 'sqrt'
        ? sqrtDimension(dimensionOf(node.arg, quantityDimensions))
        : dimensionOf(node.arg, quantityDimensions);
    case 'add':
    case 'subtract': {
      const left = dimensionOf(node.left, quantityDimensions);
      const right = dimensionOf(node.right, quantityDimensions);
      if (!dimensionsEqual(left, right)) {
        throw new DimensionError(
          'add-mismatch',
          `Нельзя ${node.type === 'add' ? 'складывать' : 'вычитать'} величины с размерностями ${formatDimension(left)} и ${formatDimension(right)}.`,
        );
      }
      return left;
    }
    case 'multiply':
      return multiplyDimensions(
        dimensionOf(node.left, quantityDimensions),
        dimensionOf(node.right, quantityDimensions),
      );
    case 'divide':
      return divideDimensions(
        dimensionOf(node.left, quantityDimensions),
        dimensionOf(node.right, quantityDimensions),
      );
    case 'power': {
      if (!Number.isInteger(node.exponent)) {
        throw new DimensionError(
          'power-not-integer',
          'Показатель степени должен быть целым числом.',
        );
      }
      return powerDimension(dimensionOf(node.base, quantityDimensions), node.exponent);
    }
  }
}

export interface DimensionCheck {
  ok: boolean;
  lhs: DimensionVector | null;
  rhs: DimensionVector | null;
  message: string | null;
}

export function checkEquationDimensions(
  lhs: AstNode,
  rhs: AstNode,
  quantityDimensions: ReadonlyMap<string, DimensionVector>,
): DimensionCheck {
  let left: DimensionVector | null = null;
  let right: DimensionVector | null = null;
  try {
    left = dimensionOf(lhs, quantityDimensions);
  } catch (error) {
    return {
      ok: false,
      lhs: null,
      rhs: null,
      message: error instanceof DimensionError ? error.message : 'Неизвестная ошибка размерностей.',
    };
  }
  try {
    right = dimensionOf(rhs, quantityDimensions);
  } catch (error) {
    return {
      ok: false,
      lhs: left,
      rhs: null,
      message: error instanceof DimensionError ? error.message : 'Неизвестная ошибка размерностей.',
    };
  }
  if (!dimensionsEqual(left, right)) {
    return {
      ok: false,
      lhs: left,
      rhs: right,
      message: `Левая часть имеет размерность ${formatDimension(left)}, правая — ${formatDimension(right)}.`,
    };
  }
  return { ok: true, lhs: left, rhs: right, message: null };
}

export function quantityDimensionsFrom(kb: KnowledgeBase): Map<string, DimensionVector> {
  const dimensions = new Map(kb.dimensions.map((dimension) => [dimension.id, dimension.exponents]));
  const result = new Map<string, DimensionVector>();
  for (const quantity of kb.quantities) {
    const exponents = dimensions.get(quantity.dimensionId);
    if (exponents) result.set(quantity.id, exponents);
  }
  return result;
}

export function dimensionName(kb: KnowledgeBase, dimensionId: string): string {
  const dimension = kb.dimensions.find((item) => item.id === dimensionId);
  return dimension ? formatDimension(dimension.exponents) : dimensionId;
}