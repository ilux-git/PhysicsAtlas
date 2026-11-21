import { describe, expect, it } from 'vitest';
import { loadKnowledgeBase } from '../../knowledge/index.ts';
import { buildGraph } from './build.ts';
import { layoutNeighborhood } from './layout.ts';

const { kb } = loadKnowledgeBase();
const graph = buildGraph(kb!);

describe('deterministic neighbourhood layout', () => {
  it('places the focus at the centre and neighbours on rings', () => {
    const layout = layoutNeighborhood(graph, 'q.force', { radius: 1 });
    const focus = layout.nodes.find((node) => node.id === 'q.force');
    expect(focus).toMatchObject({ x: 0, y: 0, hop: 0 });

    const equation = layout.nodes.find((node) => node.id === 'eq.newton2.magnitudes');
    expect(equation?.hop).toBe(1);
    expect(Math.hypot(equation?.x ?? 0, equation?.y ?? 0)).toBeCloseTo(150, 3);
  });

  it('is deterministic for the same input', () => {
    const first = layoutNeighborhood(graph, 'q.mass', { radius: 2 });
    const second = layoutNeighborhood(graph, 'q.mass', { radius: 2 });
    expect(second).toEqual(first);
  });

  it('extends with radius', () => {
    const one = layoutNeighborhood(graph, 'q.force', { radius: 1 });
    const two = layoutNeighborhood(graph, 'q.force', { radius: 2 });
    expect(two.nodes.length).toBeGreaterThan(one.nodes.length);
    expect(two.bounds.width).toBeGreaterThan(one.bounds.width);
  });

  it('honours entity filters and keeps the focus visible', () => {
    const layout = layoutNeighborhood(graph, 'eq.newton2.magnitudes', {
      radius: 1,
      filter: { entityKinds: ['quantity'] },
    });
    const ids = layout.nodes.map((node) => node.id);
    expect(ids).toContain('eq.newton2.magnitudes');
    expect(ids).toContain('q.force');
    expect(ids).not.toContain('unit.newton');
  });

  it('only includes edges whose endpoints are laid out', () => {
    const layout = layoutNeighborhood(graph, 'q.force', { radius: 2 });
    const ids = new Set(layout.nodes.map((node) => node.id));
    for (const edge of layout.edges) {
      expect(ids.has(edge.from)).toBe(true);
      expect(ids.has(edge.to)).toBe(true);
    }
  });
});