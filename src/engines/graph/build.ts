import type {
  Diagnostic,
  Edge,
  EdgeKind,
  Entity,
  EntityKind,
  KnowledgeBase,
} from '../../domain/types.ts';

export interface Graph {
  kb: KnowledgeBase;
  nodes: ReadonlyMap<string, Entity>;
  outgoing: ReadonlyMap<string, readonly Edge[]>;
  incoming: ReadonlyMap<string, readonly Edge[]>;
}

export interface NeighborFilter {
  edgeKinds?: readonly EdgeKind[];
  entityKinds?: readonly EntityKind[];
  direction?: 'in' | 'out' | 'both';
}

export interface Neighbor {
  id: string;
  entity: Entity;
  edge: Edge;
  direction: 'in' | 'out';
}

export function buildGraph(kb: KnowledgeBase): Graph {
  const outgoing = new Map<string, Edge[]>();
  const incoming = new Map<string, Edge[]>();
  for (const edge of kb.edges) {
    const out = outgoing.get(edge.from) ?? [];
    out.push(edge);
    outgoing.set(edge.from, out);
    const incomingList = incoming.get(edge.to) ?? [];
    incomingList.push(edge);
    incoming.set(edge.to, incomingList);
  }
  return { kb, nodes: kb.entities, outgoing, incoming };
}

function passes(entity: Entity, filter?: NeighborFilter): boolean {
  if (!filter?.entityKinds) return true;
  return filter.entityKinds.includes(entity.kind);
}

function edgeAllowed(edge: Edge, filter?: NeighborFilter): boolean {
  if (!filter?.edgeKinds) return true;
  return filter.edgeKinds.includes(edge.kind);
}

export function neighbors(graph: Graph, id: string, filter?: NeighborFilter): Neighbor[] {
  const direction = filter?.direction ?? 'both';
  const result: Neighbor[] = [];
  if (direction === 'in' || direction === 'both') {
    for (const edge of graph.incoming.get(id) ?? []) {
      if (!edgeAllowed(edge, filter)) continue;
      const entity = graph.nodes.get(edge.from);
      if (!entity || !passes(entity, filter)) continue;
      result.push({ id: entity.id, entity, edge, direction: 'in' });
    }
  }
  if (direction === 'out' || direction === 'both') {
    for (const edge of graph.outgoing.get(id) ?? []) {
      if (!edgeAllowed(edge, filter)) continue;
      const entity = graph.nodes.get(edge.to);
      if (!entity || !passes(entity, filter)) continue;
      result.push({ id: entity.id, entity, edge, direction: 'out' });
    }
  }
  return result;
}

export interface Neighborhood {
  focusId: string;
  distances: ReadonlyMap<string, number>;
  nodes: readonly Entity[];
  edges: readonly Edge[];
}

export function neighborhood(
  graph: Graph,
  focusId: string,
  radius: number,
  filter?: NeighborFilter,
): Neighborhood {
  const clampedRadius = Math.max(0, Math.min(4, Math.trunc(radius)));
  const distances = new Map<string, number>([[focusId, 0]]);
  const queue: string[] = [focusId];
  while (queue.length > 0) {
    const current = queue.shift();
    if (current === undefined) break;
    const distance = distances.get(current) ?? 0;
    if (distance >= clampedRadius) continue;
    for (const neighbor of neighbors(graph, current, filter)) {
      if (distances.has(neighbor.id)) continue;
      distances.set(neighbor.id, distance + 1);
      queue.push(neighbor.id);
    }
  }

  const focus = graph.nodes.get(focusId);
  const nodes: Entity[] = [];
  if (focus) nodes.push(focus);
  for (const id of distances.keys()) {
    if (id === focusId) continue;
    const entity = graph.nodes.get(id);
    if (entity && passes(entity, filter)) nodes.push(entity);
  }

  const edges = graph.kb.edges.filter(
    (edge) =>
      distances.has(edge.from) &&
      distances.has(edge.to) &&
      (!filter?.edgeKinds || filter.edgeKinds.includes(edge.kind)),
  );

  return { focusId, distances, nodes, edges };
}

export function filterEntities(
  graph: Graph,
  predicate: (entity: Entity) => boolean,
): Entity[] {
  return [...graph.nodes.values()].filter(predicate);
}

export function edgesOfKind(graph: Graph, kind: EdgeKind): Edge[] {
  return graph.kb.edges.filter((edge) => edge.kind === kind);
}

export function graphIntegrity(graph: Graph): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const edge of graph.kb.edges) {
    if (!graph.nodes.has(edge.from)) {
      diagnostics.push({
        severity: 'error',
        code: 'edge-missing-node',
        message: `Ребро «${edge.id}» начинается в несуществующем узле «${edge.from}».`,
        entityId: edge.from,
      });
    }
    if (!graph.nodes.has(edge.to)) {
      diagnostics.push({
        severity: 'error',
        code: 'edge-missing-node',
        message: `Ребро «${edge.id}» ведёт в несуществующий узел «${edge.to}».`,
        entityId: edge.to,
      });
    }
  }
  return diagnostics;
}

export function edgeKey(kind: EdgeKind, from: string, to: string): string {
  return `${kind}:${from}->${to}`;
}