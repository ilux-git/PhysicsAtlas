import type { Edge } from '../../domain/types.ts';
import { neighborhood, type Graph, type NeighborFilter } from './build.ts';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  hop: number;
}

export interface LayoutBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface LayoutResult {
  focusId: string;
  nodes: readonly LayoutNode[];
  edges: readonly Edge[];
  bounds: LayoutBounds;
}

export interface LayoutOptions {
  radius?: number;
  filter?: NeighborFilter;
  ringGap?: number;
}

function round(value: number): number {
  return Math.round(value * 10000) / 10000;
}

export function layoutNeighborhood(
  graph: Graph,
  focusId: string,
  options: LayoutOptions = {},
): LayoutResult {
  const radius = options.radius ?? 1;
  const ringGap = options.ringGap ?? 150;
  const hood = neighborhood(graph, focusId, radius, options.filter);

  const rings = new Map<number, string[]>();
  for (const [id, hop] of hood.distances) {
    const ring = rings.get(hop) ?? [];
    ring.push(id);
    rings.set(hop, ring);
  }

  const nodes: LayoutNode[] = [];
  const focus = rings.get(0)?.[0];
  if (focus !== undefined) {
    nodes.push({ id: focus, x: 0, y: 0, hop: 0 });
  }

  const maxRing = Math.max(0, ...rings.keys());
  for (let hop = 1; hop <= maxRing; hop += 1) {
    const ids = rings.get(hop);
    if (!ids || ids.length === 0) continue;
    ids.sort((left, right) => left.localeCompare(right));
    const count = ids.length;
    const startAngle = -Math.PI / 2 + hop * 0.35;
    const offset = (hop % 2) * (Math.PI / count);
    ids.forEach((id, position) => {
      const angle = startAngle + offset + (2 * Math.PI * position) / count;
      const ringRadius = hop * ringGap;
      nodes.push({
        id,
        x: round(ringRadius * Math.cos(angle)),
        y: round(ringRadius * Math.sin(angle)),
        hop,
      });
    });
  }

  let minX = 0;
  let minY = 0;
  let maxX = 0;
  let maxY = 0;
  for (const node of nodes) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
    maxX = Math.max(maxX, node.x);
    maxY = Math.max(maxY, node.y);
  }
  const padding = ringGap * 0.6;
  const bounds: LayoutBounds = {
    minX: minX - padding,
    minY: minY - padding,
    maxX: maxX + padding,
    maxY: maxY + padding,
    width: maxX - minX + 2 * padding,
    height: maxY - minY + 2 * padding,
  };

  return { focusId, nodes, edges: hood.edges, bounds };
}