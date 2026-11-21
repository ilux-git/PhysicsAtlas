import { useMemo, useRef, useState } from 'react';
import { isEntityVisible, useAtlas } from '../app/state.tsx';
import type { Entity, EntityKind } from '../domain/types.ts';
import { formatDimension } from '../engines/dimensions.ts';
import { layoutNeighborhood } from '../engines/graph/layout.ts';
import {
  EDGE_KIND_GROUP,
  EDGE_KIND_LABELS,
  ENTITY_KIND_LABELS,
  entityShortLabel,
} from './labels.ts';

const EDGE_COLORS: Record<'physical' | 'mathematical' | 'structural', string> = {
  physical: '#4f46e5',
  mathematical: '#9333ea',
  structural: '#64748b',
};

const EDGE_DASH: Record<string, string | undefined> = {
  physical: undefined,
  mathematical: '6 4',
  structural: '2 4',
};

const NODE_HALF: Record<EntityKind, number> = {
  quantity: 26,
  equation: 38,
  law: 28,
  unit: 24,
  dimension: 26,
  condition: 32,
  derivation: 34,
};

interface View {
  k: number;
  x: number;
  y: number;
}

function clampValue(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function nodeLabel(entity: Entity): string {
  if (entity.kind === 'quantity' || entity.kind === 'unit') return entity.symbol;
  if (entity.kind === 'dimension') return entity.name.ru;
  return entityShortLabel(entity);
}

function NodeShape({ entity }: { entity: Entity }) {
  switch (entity.kind) {
    case 'quantity':
      return (
        <>
          <circle r={26} className="node-shape" />
          <text className="node-symbol" y={5}>
            {entity.symbol}
          </text>
        </>
      );
    case 'unit':
      return (
        <>
          <rect x={-23} y={-17} width={46} height={34} rx={7} className="node-shape" />
          <text className="node-symbol node-symbol-small" y={4}>
            {entity.symbol}
          </text>
        </>
      );
    case 'dimension':
      return (
        <>
          <polygon points="0,-25 24,18 -24,18" className="node-shape" />
          <text className="node-symbol node-symbol-small" y={10}>
            △
          </text>
        </>
      );
    case 'equation':
      return (
        <>
          <rect x={-38} y={-19} width={76} height={38} rx={9} className="node-shape" />
          <text className="node-symbol node-symbol-small" y={5}>
            =
          </text>
        </>
      );
    case 'law':
      return (
        <>
          <polygon points="0,-28 28,0 0,28 -28,0" className="node-shape" />
          <text className="node-symbol node-symbol-small" y={5}>
            §
          </text>
        </>
      );
    case 'condition':
      return (
        <>
          <ellipse rx={31} ry={19} className="node-shape node-shape-dashed" />
          <text className="node-symbol node-symbol-small" y={5}>
            !
          </text>
        </>
      );
    case 'derivation':
      return (
        <>
          <polygon points="-28,-17 20,-17 28,17 -20,17" className="node-shape" />
          <text className="node-symbol node-symbol-small" y={5}>
            ⇒
          </text>
        </>
      );
  }
}

function labelOffset(entity: Entity): number {
  return entity.kind === 'quantity' || entity.kind === 'unit' ? 44 : 42;
}

export function MapCanvas() {
  const { kb, graph, state, dispatch } = useAtlas();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    viewX: number;
    viewY: number;
    unitsPerPixel: number;
  } | null>(null);
  const [view, setView] = useState<View>({ k: 1, x: 0, y: 0 });

  const layout = useMemo(
    () =>
      layoutNeighborhood(graph, state.selectedId, {
        radius: state.radius,
        filter: { entityKinds: state.filters.nodeKinds, edgeKinds: state.filters.edgeKinds },
      }),
    [graph, state.selectedId, state.radius, state.filters.nodeKinds, state.filters.edgeKinds],
  );

  const visibleNodes = useMemo(
    () =>
      layout.nodes.filter((node) => {
        if (node.id === state.selectedId) return true;
        const entity = kb.entities.get(node.id);
        if (!entity) return false;
        return isEntityVisible(entity, state.level, state.domain);
      }),
    [layout.nodes, kb, state.selectedId, state.level, state.domain],
  );

  const visibleIds = useMemo(() => new Set(visibleNodes.map((node) => node.id)), [visibleNodes]);

  const positionById = useMemo(() => {
    const positions = new Map<string, { x: number; y: number }>();
    for (const node of visibleNodes) positions.set(node.id, { x: node.x, y: node.y });
    return positions;
  }, [visibleNodes]);

  const visibleEdges = useMemo(
    () =>
      layout.edges.filter(
        (edge) =>
          visibleIds.has(edge.from) &&
          visibleIds.has(edge.to) &&
          state.filters.edgeKinds.includes(edge.kind),
      ),
    [layout.edges, visibleIds, state.filters.edgeKinds],
  );

  const highlight = state.highlight;
  const highlightedNodeSet = useMemo(() => new Set(highlight?.nodes ?? []), [highlight]);
  const highlightedEdgeSet = useMemo(() => new Set(highlight?.edges ?? []), [highlight]);

  const visibleBounds = useMemo(() => {
    if (visibleNodes.length === 0) return layout.bounds;
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;
    for (const node of visibleNodes) {
      minX = Math.min(minX, node.x);
      minY = Math.min(minY, node.y);
      maxX = Math.max(maxX, node.x);
      maxY = Math.max(maxY, node.y);
    }
    const padding = 110;
    const width = Math.max(320, maxX - minX + padding * 2);
    const height = Math.max(320, maxY - minY + padding * 2);
    return {
      minX: (minX + maxX) / 2 - width / 2,
      minY: (minY + maxY) / 2 - height / 2,
      width,
      height,
    };
  }, [visibleNodes, layout.bounds]);

  const viewBox = `${visibleBounds.minX} ${visibleBounds.minY} ${visibleBounds.width} ${visibleBounds.height}`;

  const selectNode = (id: string): void => {
    dispatch({ type: 'select', id });
  };

  return (
    <div className="map">
      <div className="map-header">
        <div>
          <span className="map-eyebrow">Локальная область</span>
          <strong>
            {kb.entities.get(state.selectedId)?.name.ru ?? state.selectedId}
          </strong>
        </div>
        <div className="map-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="Уменьшить масштаб"
            onClick={() => setView((current) => ({ ...current, k: clampValue(current.k * 0.85, 0.5, 3) }))}
          >
            −
          </button>
          <button
            type="button"
            className="icon-button"
            aria-label="Увеличить масштаб"
            onClick={() => setView((current) => ({ ...current, k: clampValue(current.k * 1.15, 0.5, 3) }))}
          >
            +
          </button>
          <button
            type="button"
            className="text-button"
            onClick={() => setView({ k: 1, x: 0, y: 0 })}
          >
            Вписать
          </button>
        </div>
      </div>

      <svg
        ref={svgRef}
        className="map-svg"
        viewBox={viewBox}
        role="application"
        aria-label="Карта связей выбранного объекта"
        onWheel={(event) => {
          const factor = event.deltaY < 0 ? 1.1 : 0.91;
          setView((current) => ({ ...current, k: clampValue(current.k * factor, 0.5, 3) }));
        }}
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          if ((event.target as Element).closest('[data-node]')) return;
          const svg = svgRef.current;
          if (!svg) return;
          const rect = svg.getBoundingClientRect();
          dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            viewX: view.x,
            viewY: view.y,
            unitsPerPixel: visibleBounds.width / Math.max(1, rect.width),
          };
          svg.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = dragRef.current;
          if (!drag || drag.pointerId !== event.pointerId) return;
          const dx = (event.clientX - drag.startX) * drag.unitsPerPixel;
          const dy = (event.clientY - drag.startY) * drag.unitsPerPixel;
          setView((current) => ({ ...current, x: drag.viewX + dx, y: drag.viewY + dy }));
        }}
        onPointerUp={(event) => {
          const drag = dragRef.current;
          if (!drag) return;
          dragRef.current = null;
          svgRef.current?.releasePointerCapture(event.pointerId);
        }}
        onPointerCancel={() => {
          dragRef.current = null;
        }}
      >
        <defs>
          <marker
            id="arrow-physical"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 z" fill={EDGE_COLORS.physical} />
          </marker>
          <marker
            id="arrow-mathematical"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 z" fill={EDGE_COLORS.mathematical} />
          </marker>
          <marker
            id="arrow-structural"
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L8,4 L0,8 z" fill={EDGE_COLORS.structural} />
          </marker>
        </defs>

        <g transform={`translate(${view.x} ${view.y}) scale(${view.k})`}>
          {visibleEdges.map((edge) => {
            const from = positionById.get(edge.from);
            const to = positionById.get(edge.to);
            if (!from || !to) return null;
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const length = Math.hypot(dx, dy);
            if (length < 1) return null;
            const fromEntity = kb.entities.get(edge.from);
            const toEntity = kb.entities.get(edge.to);
            if (!fromEntity || !toEntity) return null;
            const startOffset = NODE_HALF[fromEntity.kind] + 4;
            const endOffset = NODE_HALF[toEntity.kind] + 6;
            const ux = dx / length;
            const uy = dy / length;
            const x1 = from.x + ux * startOffset;
            const y1 = from.y + uy * startOffset;
            const x2 = to.x - ux * endOffset;
            const y2 = to.y - uy * endOffset;
            const group = EDGE_KIND_GROUP[edge.kind];
            const isHighlighted = highlightedEdgeSet.has(edge.id);
            const dimmed = highlight !== null && !isHighlighted;
            return (
              <g
                key={edge.id}
                className={`edge ${isHighlighted ? 'is-highlighted' : ''} ${dimmed ? 'is-dimmed' : ''}`}
              >
                <line
                  x1={x1}
                  y1={y1}
                  x2={x2}
                  y2={y2}
                  stroke={EDGE_COLORS[group]}
                  strokeWidth={isHighlighted ? 3.2 : 1.6}
                  strokeDasharray={EDGE_DASH[group]}
                  markerEnd={`url(#arrow-${group})`}
                />
                <title>{`${EDGE_KIND_LABELS[edge.kind]}: ${fromEntity.name.ru} → ${toEntity.name.ru}`}</title>
              </g>
            );
          })}

          {visibleNodes.map((node) => {
            const entity = kb.entities.get(node.id);
            if (!entity) return null;
            const isSelected = node.id === state.selectedId;
            const isHighlighted = highlightedNodeSet.has(node.id);
            const dimmed = highlight !== null && !isHighlighted;
            return (
              <g
                key={node.id}
                data-node="true"
                className={`node node-${entity.kind} ${isSelected ? 'is-selected' : ''} ${
                  isHighlighted ? 'is-highlighted' : ''
                } ${dimmed ? 'is-dimmed' : ''}`}
                transform={`translate(${node.x} ${node.y}) scale(${1 / view.k})`}
                role="button"
                tabIndex={0}
                aria-label={`${ENTITY_KIND_LABELS[entity.kind]}: ${entity.name.ru}`}
                aria-pressed={isSelected}
                onClick={() => selectNode(node.id)}
                onDoubleClick={() => {
                  selectNode(node.id);
                  dispatch({ type: 'radius', radius: Math.min(4, state.radius + 1) });
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    selectNode(node.id);
                  }
                }}
              >
                <NodeShape entity={entity} />
                <text className="node-label" y={labelOffset(entity)}>
                  {nodeLabel(entity).slice(0, 22)}
                </text>
                <title>
                  {`${ENTITY_KIND_LABELS[entity.kind]}: ${entity.name.ru}${
                    entity.kind === 'quantity' ? ` (${entity.symbol})` : ''
                  }${entity.kind === 'dimension' ? ` — ${formatDimension(entity.exponents)}` : ''}`}
                </title>
              </g>
            );
          })}
        </g>
      </svg>

      <p className="map-hint">
        Клик — выбрать · Двойной клик — раскрыть связи · Колесо — масштаб · Перетаскивание — сдвиг
      </p>

      {visibleNodes.length <= 1 && (
        <p className="map-empty">
          Связей в выбранной области нет. Увеличьте глубину или включите фильтры.
        </p>
      )}
    </div>
  );
}

