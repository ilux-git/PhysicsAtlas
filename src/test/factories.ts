import type { EntityBase, LevelPresentations } from '../domain/types.ts';

export function baseEntity(
  id: string,
  name: string,
  overrides: Partial<EntityBase> = {},
): EntityBase {
  const levelPresentations: LevelPresentations = {
    '7-8': { summary: { ru: name } },
    '9': { summary: { ru: name } },
    '10-11': { summary: { ru: name } },
  };
  return {
    id,
    slug: id.replace(/^[a-z]+\./, ''),
    name: { ru: name },
    aliases: [],
    description: { ru: name },
    levelPresentations,
    domains: ['domain.mechanics'],
    sources: ['source.test'],
    review: { formulation: 'standard-school', expert: 'none' },
    ...overrides,
  };
}