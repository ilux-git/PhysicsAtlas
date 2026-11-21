import type { Unit } from '../domain/types.ts';

export type ConversionErrorCode =
  | 'unknown-unit'
  | 'invalid-unit'
  | 'dimension-mismatch'
  | 'group-mismatch'
  | 'non-finite';

export interface ConversionFailure {
  ok: false;
  code: ConversionErrorCode;
  message: string;
}

export interface ConversionSuccess {
  ok: true;
  value: number;
  siValue: number;
  from: Unit;
  to: Unit;
}

export type ConversionResult = ConversionSuccess | ConversionFailure;

export function toSI(value: number, unit: Unit): number {
  return value * unit.factor + unit.offset;
}

export function fromSI(value: number, unit: Unit): number {
  return (value - unit.offset) / unit.factor;
}

function validateUnit(unit: Unit): ConversionFailure | null {
  if (!Number.isFinite(unit.factor) || unit.factor <= 0) {
    return {
      ok: false,
      code: 'invalid-unit',
      message: `У единицы «${unit.id}» некорректный коэффициент пересчёта: он должен быть положительным конечным числом.`,
    };
  }
  if (!Number.isFinite(unit.offset)) {
    return {
      ok: false,
      code: 'invalid-unit',
      message: `У единицы «${unit.id}» некорректное смещение: оно должно быть конечным числом.`,
    };
  }
  return null;
}

export function unitsCompatible(
  fromId: string,
  toId: string,
  units: ReadonlyMap<string, Unit>,
): ConversionFailure | { ok: true; from: Unit; to: Unit } {
  const from = units.get(fromId);
  const to = units.get(toId);
  if (!from) {
    return { ok: false, code: 'unknown-unit', message: `Единица «${fromId}» не найдена.` };
  }
  if (!to) {
    return { ok: false, code: 'unknown-unit', message: `Единица «${toId}» не найдена.` };
  }
  const fromProblem = validateUnit(from);
  if (fromProblem) return fromProblem;
  const toProblem = validateUnit(to);
  if (toProblem) return toProblem;
  if (from.dimensionId !== to.dimensionId) {
    return {
      ok: false,
      code: 'dimension-mismatch',
      message: `Размерности различаются: «${from.dimensionId}» и «${to.dimensionId}»; перевод невозможен.`,
    };
  }
  if (from.conversionGroup !== to.conversionGroup) {
    return {
      ok: false,
      code: 'group-mismatch',
      message: `Одинаковая размерность не означает взаимозаменяемость: единицы «${from.id}» и «${to.id}» относятся к разным группам величин («${from.conversionGroup}» и «${to.conversionGroup}»).`,
    };
  }
  return { ok: true, from, to };
}

export function convertUnit(
  value: number,
  fromId: string,
  toId: string,
  units: ReadonlyMap<string, Unit>,
): ConversionResult {
  if (!Number.isFinite(value)) {
    return { ok: false, code: 'non-finite', message: 'Исходное значение должно быть конечным числом.' };
  }
  const compatible = unitsCompatible(fromId, toId, units);
  if ('ok' in compatible && compatible.ok === false) return compatible;
  if (!('ok' in compatible) || compatible.ok !== true) {
    return { ok: false, code: 'unknown-unit', message: 'Не удалось определить единицы перевода.' };
  }
  const siValue = toSI(value, compatible.from);
  const result = fromSI(siValue, compatible.to);
  if (!Number.isFinite(result)) {
    return {
      ok: false,
      code: 'non-finite',
      message: 'Результат пересчёта не является конечным числом.',
    };
  }
  return { ok: true, value: result, siValue, from: compatible.from, to: compatible.to };
}