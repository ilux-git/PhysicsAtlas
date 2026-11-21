import { describe, expect, it } from 'vitest';
import type { KnowledgeBase } from '../domain/types.ts';
import { loadKnowledgeBase } from '../knowledge/index.ts';
import {
  appReducer,
  createInitialState,
  DEFAULT_STATE,
  formatHash,
  parseHash,
} from './state.tsx';

describe('application state', () => {
  it('keeps at least one node kind enabled', () => {
    const onlyQuantities = {
      ...DEFAULT_STATE,
      filters: { ...DEFAULT_STATE.filters, nodeKinds: ['quantity' as const] },
    };
    expect(appReducer(onlyQuantities, { type: 'toggle-node-kind', kind: 'quantity' })).toBe(
      onlyQuantities,
    );
  });

  it('selecting a node clears the highlighted route', () => {
    const state = {
      ...DEFAULT_STATE,
      highlight: { nodes: ['q.force'], edges: [] },
    };
    const next = appReducer(state, { type: 'select', id: 'q.mass' });
    expect(next.selectedId).toBe('q.mass');
    expect(next.highlight).toBeNull();
  });

  it('clamps the neighbourhood radius', () => {
    expect(appReducer(DEFAULT_STATE, { type: 'radius', radius: 9 }).radius).toBe(4);
    expect(appReducer(DEFAULT_STATE, { type: 'radius', radius: 0 }).radius).toBe(1);
  });

  it('round-trips the URL hash', () => {
    const state = {
      ...DEFAULT_STATE,
      selectedId: 'law.newton.second',
      level: '10-11' as const,
      domain: 'domain.mechanics',
      radius: 3,
      tab: 'formulas' as const,
    };
    expect(parseHash(`#${formatHash(state)}`)).toMatchObject({
      selectedId: state.selectedId,
      level: state.level,
      domain: state.domain,
      radius: state.radius,
      tab: state.tab,
    });
  });

  it('ignores invalid hash values', () => {
    const parsed = parseHash('#node=q.mass&level=12&radius=99&tab=unknown');
    expect(parsed.level).toBeUndefined();
    expect(parsed.radius).toBeUndefined();
    expect(parsed.tab).toBeUndefined();
    expect(parsed.selectedId).toBe('q.mass');
  });

  it('falls back to an existing node for an unknown deep link', () => {
    const { kb } = loadKnowledgeBase();
    const state = createInitialState(kb as KnowledgeBase, '#node=q.unknown&domain=domain.nope');
    expect(kb!.entities.has(state.selectedId)).toBe(true);
    expect(state.domain).toBe('all');
  });
});