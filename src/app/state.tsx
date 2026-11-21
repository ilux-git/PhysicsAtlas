import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useReducer,
  type Dispatch,
  type ReactNode,
} from 'react';
import type {
  EdgeKind,
  EntityKind,
  KnowledgeBase,
  LevelKey,
  LevelPresentations,
} from '../domain/types.ts';
import { buildGraph, type Graph } from '../engines/graph/build.ts';
import { buildSearchIndex, type SearchIndex } from '../engines/graph/search.ts';

export type Tab = 'card' | 'formulas' | 'converter' | 'derivation' | 'path';

export const TABS: ReadonlyArray<{ id: Tab; label: string }> = [
  { id: 'card', label: 'Карточка' },
  { id: 'formulas', label: 'Формулы' },
  { id: 'converter', label: 'Конвертер' },
  { id: 'derivation', label: 'Вывод' },
  { id: 'path', label: 'Поиск пути' },
];

export interface Filters {
  nodeKinds: EntityKind[];
  edgeKinds: EdgeKind[];
}

export interface Highlight {
  nodes: string[];
  edges: string[];
}

export interface AppState {
  selectedId: string;
  level: LevelKey;
  domain: string;
  radius: number;
  filters: Filters;
  tab: Tab;
  query: string;
  highlight: Highlight | null;
}

export const ALL_ENTITY_KINDS: readonly EntityKind[] = [
  'quantity',
  'equation',
  'law',
  'unit',
  'dimension',
  'condition',
  'derivation',
];

export const ALL_EDGE_KINDS: readonly EdgeKind[] = [
  'appears_in',
  'expresses',
  'derived_from',
  'has_unit',
  'has_dimension',
  'equivalent_unit',
  'requires_condition',
  'related_to',
  'has_derivation',
  'produces',
];

export const DEFAULT_STATE: AppState = {
  selectedId: 'q.force',
  level: '9',
  domain: 'all',
  radius: 1,
  filters: {
    nodeKinds: [...ALL_ENTITY_KINDS],
    edgeKinds: [...ALL_EDGE_KINDS],
  },
  tab: 'card',
  query: '',
  highlight: null,
};

export type Action =
  | { type: 'select'; id: string }
  | { type: 'level'; level: LevelKey }
  | { type: 'domain'; domain: string }
  | { type: 'radius'; radius: number }
  | { type: 'toggle-node-kind'; kind: EntityKind }
  | { type: 'toggle-edge-kind'; kind: EdgeKind }
  | { type: 'reset-filters' }
  | { type: 'tab'; tab: Tab }
  | { type: 'query'; query: string }
  | { type: 'highlight'; highlight: Highlight | null };

export function appReducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'select':
      return { ...state, selectedId: action.id, highlight: null };
    case 'level':
      return { ...state, level: action.level };
    case 'domain':
      return { ...state, domain: action.domain };
    case 'radius':
      return { ...state, radius: Math.max(1, Math.min(4, action.radius)) };
    case 'toggle-node-kind': {
      const present = state.filters.nodeKinds.includes(action.kind);
      if (present && state.filters.nodeKinds.length === 1) return state;
      return {
        ...state,
        filters: {
          ...state.filters,
          nodeKinds: present
            ? state.filters.nodeKinds.filter((kind) => kind !== action.kind)
            : [...state.filters.nodeKinds, action.kind],
        },
      };
    }
    case 'toggle-edge-kind': {
      const present = state.filters.edgeKinds.includes(action.kind);
      if (present && state.filters.edgeKinds.length === 1) return state;
      return {
        ...state,
        filters: {
          ...state.filters,
          edgeKinds: present
            ? state.filters.edgeKinds.filter((kind) => kind !== action.kind)
            : [...state.filters.edgeKinds, action.kind],
        },
      };
    }
    case 'reset-filters':
      return {
        ...state,
        filters: { nodeKinds: [...ALL_ENTITY_KINDS], edgeKinds: [...ALL_EDGE_KINDS] },
      };
    case 'tab':
      return { ...state, tab: action.tab };
    case 'query':
      return { ...state, query: action.query };
    case 'highlight':
      return { ...state, highlight: action.highlight };
  }
}

const LEVELS: readonly LevelKey[] = ['7-8', '9', '10-11'];

export function parseHash(hash: string): Partial<AppState> {
  const text = hash.startsWith('#') ? hash.slice(1) : hash;
  const params = new URLSearchParams(text);
  const parsed: Partial<AppState> = {};
  const node = params.get('node');
  if (node) parsed.selectedId = node;
  const level = params.get('level');
  if (level && (LEVELS as readonly string[]).includes(level)) parsed.level = level as LevelKey;
  const domain = params.get('domain');
  if (domain) parsed.domain = domain;
  const radius = Number(params.get('radius'));
  if (Number.isFinite(radius) && radius >= 1 && radius <= 4) parsed.radius = Math.trunc(radius);
  const tab = params.get('tab');
  if (tab && TABS.some((item) => item.id === tab)) parsed.tab = tab as Tab;
  return parsed;
}

export function formatHash(state: AppState): string {
  const params = new URLSearchParams();
  params.set('node', state.selectedId);
  params.set('level', state.level);
  params.set('domain', state.domain);
  params.set('radius', String(state.radius));
  params.set('tab', state.tab);
  return params.toString();
}

export function createInitialState(kb: KnowledgeBase, hash: string): AppState {
  const parsed = parseHash(hash);
  const selectedId =
    parsed.selectedId && kb.entities.has(parsed.selectedId)
      ? parsed.selectedId
      : kb.entities.has(DEFAULT_STATE.selectedId)
        ? DEFAULT_STATE.selectedId
        : (kb.entities.keys().next().value ?? '');
  const domain =
    parsed.domain === undefined ||
    parsed.domain === 'all' ||
    kb.domains.some((item) => item.id === parsed.domain)
      ? (parsed.domain ?? DEFAULT_STATE.domain)
      : DEFAULT_STATE.domain;
  return {
    ...DEFAULT_STATE,
    ...parsed,
    selectedId,
    domain,
  };
}

export interface AtlasContextValue {
  kb: KnowledgeBase;
  graph: Graph;
  searchIndex: SearchIndex;
  state: AppState;
  dispatch: Dispatch<Action>;
}

const AtlasContext = createContext<AtlasContextValue | null>(null);

export function AtlasProvider({ kb, children }: { kb: KnowledgeBase; children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, undefined, () =>
    createInitialState(kb, typeof window === 'undefined' ? '' : window.location.hash),
  );
  const graph = useMemo(() => buildGraph(kb), [kb]);
  const searchIndex = useMemo(() => buildSearchIndex(kb), [kb]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const next = `#${formatHash(state)}`;
    if (window.location.hash !== next) {
      window.history.replaceState(null, '', next);
    }
  }, [state.selectedId, state.level, state.domain, state.radius, state.tab]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onHashChange = (): void => {
      const parsed = parseHash(window.location.hash);
      if (parsed.selectedId && kb.entities.has(parsed.selectedId)) {
        dispatch({ type: 'select', id: parsed.selectedId });
      }
      if (parsed.level) dispatch({ type: 'level', level: parsed.level });
      if (parsed.domain) dispatch({ type: 'domain', domain: parsed.domain });
      if (parsed.radius) dispatch({ type: 'radius', radius: parsed.radius });
      if (parsed.tab) dispatch({ type: 'tab', tab: parsed.tab });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [kb]);

  const value = useMemo<AtlasContextValue>(
    () => ({ kb, graph, searchIndex, state, dispatch }),
    [kb, graph, searchIndex, state],
  );

  return <AtlasContext.Provider value={value}>{children}</AtlasContext.Provider>;
}

export function useAtlas(): AtlasContextValue {
  const value = useContext(AtlasContext);
  if (value === null) {
    throw new Error('useAtlas используется вне AtlasProvider.');
  }
  return value;
}

export function hasPresentationAtLevel(
  entity: { levelPresentations: LevelPresentations },
  level: LevelKey,
): boolean {
  return Object.keys(entity.levelPresentations).length === 0 || entity.levelPresentations[level] !== undefined;
}

export function isEntityVisible(
  entity: { domains: readonly string[]; levelPresentations: LevelPresentations },
  level: LevelKey,
  domain: string,
): boolean {
  const domainVisible = domain === 'all' || entity.domains.includes(domain);
  return domainVisible && hasPresentationAtLevel(entity, level);
}