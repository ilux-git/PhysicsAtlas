# Proposal — kinematics content fragment (Priority C)

Status: **proposal only, not implemented.** PROMPT-2 requires an entity/relation plan before a new
content direction starts, and the canonical modeling of initial velocity/deltas is an open semantic
decision. Do not add these entities until the decision below is accepted.

## 1. Why this fragment

The mechanics slice currently covers force, work, power and uniform velocity. The next connected
fragment is uniformly accelerated motion: it reuses `a`, `t`, `s`, `v`, units and dimensions already
in the atlas, and adds a minimal number of new objects. It should not be added merely to increase
counts.

## 2. Open modeling decision: initial velocity and intervals

School kinematics uses `v₀`, `v` and sometimes `Δv`, `Δs`. The atlas has one canonical quantity
`q.velocity` and one `q.displacement`. Options:

| Option | Shape | Assessment |
|---|---|---|
| A. Separate quantities `q.velocity.initial`, `q.displacement.interval` | new canonical quantities | risks duplicating the same physical object by role; conflicts with “one physical object — one ID” unless carefully defined |
| B. Role/variant on the variable reference (e.g. `variable(q.velocity, role: initial)`) | schema extension to AST variables and conditions | preserves one quantity but enlarges the AST and every consumer; needs a separate design iteration |
| C. Initial-state entity/reference frame | new node type and links | strongest semantically, but larger than the MVP needs |
| D. Use only average/current quantities | equations without `v₀` | cannot express the standard kinematic equations; would produce an incomplete fragment |

Recommendation: **do not implement any option yet.** Prefer a focused design of option B (variable
role) if initial velocity must be represented, because it keeps one canonical quantity. Option A is
acceptable only if the project explicitly decides that “velocity at the initial moment” is a distinct
quantity; that decision belongs to the product owner, not to the implementation.

## 3. Candidate entities (if option B is approved)

Quantities: reuse `q.acceleration`, `q.velocity`, `q.displacement`, `q.time`; no new quantity if roles
are supported. New conditions:

- `cond.constant-acceleration` — acceleration constant in magnitude and direction;
- `cond.linear-motion` — motion along one line (for the scalar form);
- `cond.initial-state-defined` — initial velocity and position are fixed.

Candidate equations (ASTs use scalar magnitudes; vector forms are out of scope):

1. `v = v₀ + a·t` — velocity after time `t`;
2. `s = v₀·t + a·t²/2` — displacement from the initial point;
3. `v² = v₀² + 2·a·s` — relation without explicit time (must not be used as a universal identity;
   same constant-acceleration conditions).

Possible derivation: from equation 1 and equation 2, but a full symbolic elimination is beyond the
current solver. Derivation records would be limited to declared steps/structural verification.

Units/dimensions: all already exist (`m/s`, `m/s²`, `m`, `s`). No new unit.

## 4. Relations and levels

- `appears_in` for every quantity used by each equation;
- `requires_condition` for the new conditions;
- `related_to` must **not** be used; the exact relations are `appears_in`, `requires_condition` and,
  if a derivation is declared, `derived_from`/`produces`;
- three level presentations for each new condition; equations use the existing equation card and
  level-independent form.

## 5. Conditions and physical caveats

- The equations are scalar/magnitude forms; direction is not modelled.
- `v² = v₀² + 2as` is only valid for constant acceleration along the line and must state it.
- Average vs instantaneous velocity must stay separate; a new equation must not silently replace
  `eq.velocity.uniform`.
- Sources: textbook metadata must be verified; no page/ISBN claims without a real reference. If
  verification is unavailable, mark `formulation: standard-school`, `expert: none` and keep the
  “requires verification” note.

## 6. Required tests before merge

- every display parses back to its AST (strict display validator);
- no alternative form adds/removes variables;
- every equation has explicit conditions;
- `solveFor` supports the intended targets (with multiple-solution refusal where relevant);
- path engine returns a chain with the new conditions and does not mark it physically reviewed;
- level presentations exist for new conditions;
- no `expert: completed` claim.

## 7. What must be decided first

1. Initial velocity: separate quantity (A), variable role (B), or defer (D)?
2. Is constant-acceleration content scalar-only, or does it require a vector representation?
3. Which sources are acceptable, and who verifies them?
4. Does the product owner accept that `v² = v₀² + 2as` will be marked as a conditioned standard school
   formulation, not as a reviewed law?

No code or content for this proposal is included in the current reliability phase.