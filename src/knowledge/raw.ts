import dimensions from './data/dimensions.json' with { type: 'json' };
import units from './data/units.json' with { type: 'json' };
import quantities from './data/quantities.json' with { type: 'json' };
import laws from './data/laws.json' with { type: 'json' };
import conditions from './data/conditions.json' with { type: 'json' };
import equations from './data/equations.json' with { type: 'json' };
import derivations from './data/derivations.json' with { type: 'json' };
import domains from './data/domains.json' with { type: 'json' };
import sources from './data/sources.json' with { type: 'json' };

export const rawKnowledge = {
  dimensions,
  units,
  quantities,
  laws,
  conditions,
  equations,
  derivations,
  domains,
  sources,
} as const;