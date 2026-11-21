import { describe, expect, it } from 'vitest';
import { loadKnowledgeBase } from '../../knowledge/index.ts';
import { buildSearchIndex, searchAtlas } from './search.ts';

const { kb } = loadKnowledgeBase();
const index = buildSearchIndex(kb!);

describe('atlas search', () => {
  it('finds a quantity by its Russian name', () => {
    const hits = searchAtlas(index, 'масса');
    expect(hits[0]?.entity.id).toBe('q.mass');
    expect(hits[0]?.field).toBe('name');
  });

  it('prefers an exact symbol over name fragments', () => {
    const hits = searchAtlas(index, 'm');
    expect(hits[0]?.entity.id).toBe('q.mass');
    expect(hits[0]?.field).toBe('symbol');
  });

  it('finds an equation by its formula', () => {
    const spaced = searchAtlas(index, 'F = ma');
    expect(spaced[0]?.entity.id).toBe('eq.newton2.magnitudes');
    expect(spaced[0]?.field).toBe('formula');

    const compact = searchAtlas(index, 'v=s/t');
    expect(compact[0]?.entity.id).toBe('eq.velocity.uniform');
  });

  it('finds an equation by an alternative formula alias', () => {
    const hits = searchAtlas(index, 'a = F/m');
    expect(hits[0]?.entity.id).toBe('eq.newton2.acceleration');
  });

  it('finds a law and its unit by name', () => {
    const hits = searchAtlas(index, 'ньютон');
    const ids = hits.map((hit) => hit.entity.id);
    expect(ids[0]).toBe('unit.newton');
    expect(ids).toContain('law.newton.second');
  });

  it('finds entities by canonical id', () => {
    const hits = searchAtlas(index, 'q.force');
    expect(hits[0]?.entity.id).toBe('q.force');
    expect(hits[0]?.field).toBe('id');
  });

  it('finds electricity quantities after the content extension', () => {
    const voltage = searchAtlas(index, 'напряжение');
    expect(voltage[0]?.entity.id).toBe('q.voltage');

    const ohm = searchAtlas(index, 'закон Ома');
    const ids = ohm.map((hit) => hit.entity.id);
    expect(ids).toContain('law.ohm');
    expect(ids).toContain('eq.ohm.local');
  });

  it('filters by entity kind and respects the limit', () => {
    const laws = searchAtlas(index, 'закон', { kinds: ['law'] });
    expect(laws.every((hit) => hit.entity.kind === 'law')).toBe(true);
    expect(searchAtlas(index, 'ньютон', { limit: 1 })).toHaveLength(1);
  });

  it('returns nothing for an empty or unknown query', () => {
    expect(searchAtlas(index, '')).toEqual([]);
    expect(searchAtlas(index, '   ')).toEqual([]);
    expect(searchAtlas(index, 'zzzzzz')).toEqual([]);
  });
});