import { describe, expect, it } from 'vitest';
import type { Unit } from '../domain/types.ts';
import { loadKnowledgeBase } from '../knowledge/index.ts';
import { baseEntity as base } from '../test/factories.ts';
import { convertUnit, unitsCompatible } from './units.ts';

function makeUnit(
  id: string,
  symbol: string,
  dimensionId: string,
  factor: number,
  offset: number,
  conversionGroup: string,
): Unit {
  return {
    ...base(id, symbol),
    kind: 'unit',
    symbol,
    dimensionId,
    system: 'SI',
    factor,
    offset,
    conversionGroup,
  };
}

describe('unit conversion', () => {
  const { kb } = loadKnowledgeBase();
  const units = new Map(kb!.units.map((unit) => [unit.id, unit]));

  it('converts length with factors', () => {
    expect(convertUnit(1, 'unit.kilometer', 'unit.meter', units)).toMatchObject({
      ok: true,
      value: 1000,
    });
    const result = convertUnit(1, 'unit.meter', 'unit.kilometer', units);
    expect(result.ok && result.value).toBeCloseTo(0.001, 12);
  });

  it('converts speed', () => {
    const result = convertUnit(36, 'unit.kilometer-per-hour', 'unit.meter-per-second', units);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBeCloseTo(10, 12);
  });

  it('converts units with an offset', () => {
    const temperature = new Map<string, Unit>([
      ['unit.kelvin', makeUnit('unit.kelvin', 'K', 'dim.temperature', 1, 0, 'temperature')],
      ['unit.celsius', makeUnit('unit.celsius', '°C', 'dim.temperature', 1, 273.15, 'temperature')],
    ]);
    const toKelvin = convertUnit(0, 'unit.celsius', 'unit.kelvin', temperature);
    expect(toKelvin.ok).toBe(true);
    if (toKelvin.ok) expect(toKelvin.value).toBeCloseTo(273.15, 12);

    const toCelsius = convertUnit(300, 'unit.kelvin', 'unit.celsius', temperature);
    if (toCelsius.ok) expect(toCelsius.value).toBeCloseTo(26.85, 12);
  });

  it('rejects units of different dimensions', () => {
    const result = convertUnit(1, 'unit.joule', 'unit.newton', units);
    expect(result).toMatchObject({ ok: false, code: 'dimension-mismatch' });
  });

  it('rejects the same dimension when the conversion group differs', () => {
    const torqueAndEnergy = new Map<string, Unit>([
      ['unit.joule', makeUnit('unit.joule', 'J', 'dim.energy', 1, 0, 'energy')],
      ['unit.newton-meter', makeUnit('unit.newton-meter', 'N·m', 'dim.energy', 1, 0, 'torque')],
    ]);
    const result = convertUnit(1, 'unit.joule', 'unit.newton-meter', torqueAndEnergy);
    expect(result).toMatchObject({ ok: false, code: 'group-mismatch' });
    if (!result.ok) expect(result.message).toContain('взаимозаменяемость');
    expect(unitsCompatible('unit.joule', 'unit.newton-meter', torqueAndEnergy)).toMatchObject({
      ok: false,
      code: 'group-mismatch',
    });
  });

  it('reports unknown units', () => {
    expect(convertUnit(1, 'unit.meter', 'unit.unknown', units)).toMatchObject({
      ok: false,
      code: 'unknown-unit',
    });
  });

  it('rejects non-finite input', () => {
    expect(convertUnit(Number.POSITIVE_INFINITY, 'unit.meter', 'unit.kilometer', units)).toMatchObject({
      ok: false,
      code: 'non-finite',
    });
  });
});