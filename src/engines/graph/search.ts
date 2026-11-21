import type { Entity, EntityKind, KnowledgeBase } from '../../domain/types.ts';
import { compactFormula, normalizeSearchText } from '../../domain/text.ts';
import { astToInfix } from '../ast/parse.ts';

export type SearchField = 'id' | 'symbol' | 'name' | 'alias' | 'formula' | 'description';

export interface SearchEntry {
  entity: Entity;
  id: string;
  names: string[];
  aliases: string[];
  symbols: string[];
  formulas: string[];
  description: string;
}

export interface SearchIndex {
  entries: readonly SearchEntry[];
}

export interface SearchHit {
  entity: Entity;
  score: number;
  field: SearchField;
}

export interface SearchOptions {
  limit?: number;
  kinds?: readonly EntityKind[];
}

const KIND_ORDER: Record<EntityKind, number> = {
  quantity: 0,
  equation: 1,
  law: 2,
  unit: 3,
  dimension: 4,
  condition: 5,
  derivation: 6,
};

function collectFormulas(kb: KnowledgeBase, entity: Entity): string[] {
  const formulas: string[] = [];
  if (entity.kind === 'equation') {
    formulas.push(entity.displayLatex);
    for (const form of entity.alternativeForms) formulas.push(form.displayLatex);
    const symbols = new Map(kb.quantities.map((quantity) => [quantity.id, quantity.symbol]));
    formulas.push(
      `${astToInfix(entity.lhsAst, symbols)} = ${astToInfix(entity.rhsAst, symbols)}`,
    );
  }
  for (const alias of entity.aliases) {
    if (alias.ru.includes('=') && alias.ru.includes(' ')) formulas.push(alias.ru);
    if (alias.en && alias.en.includes('=')) formulas.push(alias.en);
  }
  return formulas;
}

export function buildSearchIndex(kb: KnowledgeBase): SearchIndex {
  const entries: SearchEntry[] = [];
  for (const entity of kb.entities.values()) {
    entries.push({
      entity,
      id: normalizeSearchText(entity.id),
      names: [normalizeSearchText(entity.name.ru), ...(entity.name.en ? [normalizeSearchText(entity.name.en)] : [])],
      aliases: entity.aliases.flatMap((alias) => [
        normalizeSearchText(alias.ru),
        ...(alias.en ? [normalizeSearchText(alias.en)] : []),
      ]),
      symbols:
        entity.kind === 'quantity' || entity.kind === 'unit'
          ? [normalizeSearchText(entity.symbol)]
          : [],
      formulas: collectFormulas(kb, entity).map(compactFormula),
      description: [
        normalizeSearchText(entity.description.ru),
        ...(entity.description.en ? [normalizeSearchText(entity.description.en)] : []),
      ].join(' '),
    });
  }
  return { entries };
}

function bestMatch(entry: SearchEntry, query: string, compactQuery: string): {
  score: number;
  field: SearchField;
} | null {
  let best: { score: number; field: SearchField } | null = null;
  const consider = (score: number, field: SearchField): void => {
    if (best === null || score > best.score) best = { score, field };
  };

  if (entry.id === query) consider(1000, 'id');
  else if (entry.id.startsWith(query)) consider(300, 'id');

  for (const symbol of entry.symbols) {
    if (symbol === query) consider(900, 'symbol');
    else if (symbol.length >= 2 && symbol.startsWith(query)) consider(500, 'symbol');
  }

  for (const name of entry.names) {
    if (name === query) consider(800, 'name');
    else if (name.startsWith(query)) consider(700, 'name');
    else if (query.length >= 3 && name.includes(query)) consider(500, 'name');
  }

  for (const alias of entry.aliases) {
    if (alias === query) consider(750, 'alias');
    else if (alias.startsWith(query)) consider(650, 'alias');
    else if (query.length >= 3 && alias.includes(query)) consider(450, 'alias');
  }

  if (compactQuery.length >= 2) {
    for (const formula of entry.formulas) {
      if (formula === compactQuery) consider(850, 'formula');
      else if (formula.includes(compactQuery)) consider(400, 'formula');
    }
  }

  if (query.length >= 3 && entry.description.includes(query)) consider(100, 'description');

  return best;
}

export function searchAtlas(
  index: SearchIndex,
  query: string,
  options: SearchOptions = {},
): SearchHit[] {
  const normalized = normalizeSearchText(query);
  if (normalized.length === 0) return [];
  const compactQuery = compactFormula(query);
  const hits: SearchHit[] = [];

  for (const entry of index.entries) {
    if (options.kinds && !options.kinds.includes(entry.entity.kind)) continue;
    const match = bestMatch(entry, normalized, compactQuery);
    if (match) hits.push({ entity: entry.entity, score: match.score, field: match.field });
  }

  hits.sort((left, right) => {
    if (right.score !== left.score) return right.score - left.score;
    const kindDifference = KIND_ORDER[left.entity.kind] - KIND_ORDER[right.entity.kind];
    if (kindDifference !== 0) return kindDifference;
    return left.entity.name.ru.localeCompare(right.entity.name.ru, 'ru');
  });

  return hits.slice(0, options.limit ?? 24);
}