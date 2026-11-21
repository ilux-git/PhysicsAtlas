import { describe, expect, it } from 'vitest';
import { loadKnowledgeBase } from '../../knowledge/index.ts';
import {
  buildGraph,
  filterEntities,
  edgesOfKind,
  graphIntegrity,
  neighborhood,
  neighbors,
} from './build.ts';

const { kb } = loadKnowledgeBase();
const graph = buildGraph(kb!);

describe('graph build and queries', () => {
  it('indexes every entity in the graph', () => {
    expect(graph.nodes.size).toBe(kb!.entities.size);
  });

  it('returns typed neighbours with directions', () => {
    const massNeighbors = neighbors(graph, 'q.mass');
    const appearsIn = massNeighbors.find(
      (neighbor) => neighbor.edge.kind === 'appears_in' && neighbor.id === 'eq.newton2.magnitudes',
    );
    expect(appearsIn?.direction).toBe('out');

    const lawIncoming = neighbors(graph, 'law.newton.second', { direction: 'in' });
    expect(lawIncoming.every((neighbor) => neighbor.direction === 'in')).toBe(true);
    expect(lawIncoming.some((neighbor) => neighbor.edge.kind === 'expresses')).toBe(true);
  });

  it('filters neighbours by entity kind and edge kind', () => {
    const unitsOnly = neighbors(graph, 'q.force', { entityKinds: ['unit'] });
    expect(unitsOnly.map((neighbor) => neighbor.id)).toEqual(['unit.newton']);

    const dimensionsOnly = neighbors(graph, 'q.force', { edgeKinds: ['has_dimension'] });
    expect(dimensionsOnly.map((neighbor) => neighbor.id)).toEqual(['dim.force']);
  });

  it('builds a local neighbourhood with hop distances', () => {
    const oneHop = neighborhood(graph, 'q.force', 1);
    expect(oneHop.distances.get('q.force')).toBe(0);
    expect(oneHop.distances.get('eq.newton2.magnitudes')).toBe(1);
    expect(oneHop.distances.get('unit.newton')).toBe(1);
    expect(oneHop.distances.get('q.mass')).toBeUndefined();

    const twoHops = neighborhood(graph, 'q.force', 2);
    expect(twoHops.distances.get('q.mass')).toBe(2);
    expect(twoHops.nodes.length).toBeGreaterThan(oneHop.nodes.length);
  });

  it('returns only induced edges of the neighbourhood', () => {
    const hood = neighborhood(graph, 'q.force', 1);
    for (const edge of hood.edges) {
      expect(hood.distances.has(edge.from)).toBe(true);
      expect(hood.distances.has(edge.to)).toBe(true);
    }
  });

  it('filters entities and edges', () => {
    expect(filterEntities(graph, (entity) => entity.kind === 'quantity')).toHaveLength(8);
    const unitEdges = edgesOfKind(graph, 'equivalent_unit');
    expect(unitEdges.some((edge) => edge.from === 'unit.kilometer' && edge.to === 'unit.meter')).toBe(true);
  });

  it('reports edge integrity problems', () => {
    expect(graphIntegrity(graph)).toEqual([]);
  });
});