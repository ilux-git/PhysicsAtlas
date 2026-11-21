# Physics Atlas — implementation plan

Source of the requirements: [`PROMPT.md`](../PROMPT.md). This plan is the fixed technical
response to §1/§15 of that document and is updated only with an explicit note when reality
changes.

## Environment inventory (verified 2026-11-21)

| Item | Value |
|---|---|
| Working directory | `D:\github\PhysicsAtlas` |
| Initial contents | `PROMPT.md` only (no `.git`, no sources, no configs) |
| Git | 2.54.0.windows.1, repository initialised on branch `main`, work on `feat/physics-atlas-mvp` |
| Node.js | v24.21.0 (bundled DSH runtime; not on `PATH` — commands prepend its `bin` directory) |
| pnpm | 11.28.5 (bundled `pnpm.mjs`, run through the bundled node) |
| Registry | `registry.npmjs.org` reachable (slow responses observed) |
| Workspace permissions | repaired once with the DSH permission diagnostic; confined shell verified afterwards |

## Stack

- React 19 + Vite 8 + TypeScript (strict), client-only.
- Zod schemas for the knowledge base; Vitest + jsdom + Testing Library for tests.
- KaTeX for formula display only.
- No backend, no graph database, no CMS, no router or state library, no d3/React Flow:
  the map layout is a small deterministic pure function rendered as SVG.

## Architecture

```text
canonical JSON  ->  Zod parse  ->  reference & integrity checks  ->  derived edges
                ->  Atlas runtime (entities, edges, indexes, diagnostics)
                ->  engines (dimensions, units, AST, graph, paths)  ->  React UI
```

One source of truth: the JSON knowledge base. Graph edges and equation variable lists are
derived from primary data; computed statuses are recomputed on load and never stored as
claims. Display LaTeX is presentational only; the AST carries the mathematical meaning.

| Layer | Location | Responsibility |
|---|---|---|
| Domain types & schemas | `src/domain/` | entity shapes, Zod schemas, localized text, level keys |
| Knowledge base | `src/knowledge/data/*.json` | canonical physics content |
| Loader & validation | `src/knowledge/` | parse, cross-reference, derive edges, diagnostics |
| Math engine | `src/engines/ast/`, `dimensions.ts`, `units.ts` | AST parse/validate/evaluate/solve, dimensions, conversions |
| Graph engine | `src/engines/graph/` | build, query, search, deterministic neighbourhood layout |
| Path engine | `src/engines/paths/` | backward chaining, ranking, statuses, numeric evaluation |
| UI | `src/ui/`, `src/app/` | map, inspector, search, filters, levels, tools |
| Tooling | `scripts/validate-kb.ts` | CI-style knowledge base validation (`pnpm validate`) |

## Data model

Canonical, language- and grade-neutral IDs (`q.mass`, `eq.newton2.magnitudes`,
`unit.newton`, `dim.force`, `cond.inertial-frame`).

Every entity: `id`, `kind`, `slug`, `name {ru, en?}`, `aliases`, `description`,
`levelPresentations`, `domains`, `sources`, `review.status`.

- `LevelKey = '7-8' | '9' | '10-11'`; one canonical object carries several presentations,
  never duplicated per level or per language.
- Equation statuses stay separate: authored `physicalReview`, authored `conditionsStatus`,
  computed `structuralStatus` and `dimensionalStatus` (with messages).
- Edges: `appears_in`, `expresses`, `derived_from`, `has_unit`, `has_dimension`,
  `equivalent_unit`, `requires_condition`, `related_to`, `has_derivation`, `produces`.
  All except `related_to` are derived from primary data; `related_to` is explicit and used
  only where no exact relation fits.

## Math model

Restricted AST (`variable`, `constant`, `add`, `subtract`, `multiply`, `divide`, `power`
with numeric literal exponent, `sqrt`, `negate`). Dimensions are exponent vectors over
`L M T I Θ N J`; addition requires equality, products add exponents, `sqrt` halves them.
Units convert through `value·factor + offset` and are blocked when dimension or
`conversionGroup` differs. Solving for a variable is limited to a single occurrence with
invertible operations and explicit preconditions; no CAS. Vector quantities are modelled
as magnitudes with a form note, not as vector algebra.

## Find Path

Backward chaining over equations that can be solved for the target; unknowns recurse with
a depth limit (default 3), per-branch cycle exclusion, and a results cap. Chains carry
ordered steps, condition usage, a rank, and one status: valid, conditionally valid, or
invalid. Unconfirmed conditions produce warnings; missing paths explain the reason.

## Seed content

Mechanics slice first: m, a, F, s, t, v, A, P; `F = m·a`, `A = F·s`, `P = A/t`, `v = s/t`;
Newton's second law; conditions for inertial frame, constant force along displacement,
uniform motion, finite interval; derivations `a = F/m`, `F = A/s`, `t = A/P`; the chain
m, a, s, t → F → A → P. Electricity slice after the mechanics gates pass: I, U, R, Q,
`U = I·R`, `P = U·I`, `Q = I·t`, Ohm's law, steady-current conditions.

All seeded formulas are `standard-form` ("standard school formulation") and state that an
independent physical review has not been performed. Sources never contain invented page
numbers or ISBNs.

## Validation and tests

`pnpm validate` (also `prebuild`) rejects: schema errors, duplicate/invalid IDs, dangling or
wrong-kind references, illegal edges, invalid AST, dimension mismatch, inconsistent units,
invalid derivations, display/AST symbol divergence. Warnings never fail the build.
Vitest covers every case required by §14, including the eight named failure scenarios, plus
component tests for the main screens.

## Stages and gates

| Stage | Deliverable | Gate |
|---|---|---|
| 0 | permissions repaired, repository, branches, plan/decisions docs | confined shell, `git status`, docs review |
| 1 | scaffold, schemas, loader, mechanics seed, validator CLI, failing-first tests | `pnpm validate`, `pnpm typecheck`, `pnpm test` |
| 2 | dimensions, units, AST parse/validate/evaluate/solve | engine tests incl. failure cases, `pnpm build` |
| 3 | graph build/derive/integrity/query/search/layout | graph tests, validator wired into `prebuild` |
| 4 | app shell, map, inspector, search, filters, level and domain switching | UI tests, build, browser check |
| 5 | Find Path, derivation view, converter, formula explorer, path highlight | path tests, browser check of the seed chain |
| 6 | electricity content, hardening, full docs | full `validate && typecheck && test && build`, browser walkthrough |
| 7 | iteration report with real evidence | commands and outputs reviewed |

## Acceptance criteria (§18)

1. App starts; knowledge base loads.
2. Graph renders correctly and can be explored (neighbourhood, expand, filters, path highlight).
3. Search works over name, symbol, alias and formula.
4. Cards render for all seven entity kinds.
5. Equations have ASTs; dimensions are checked; units convert; basic transformations work.
6. Find Path finds chains and conditions are respected.
7. Levels 7-8, 9, 10-11 work on canonical objects.
8. Validations and tests pass; docs match what exists.

Each criterion is proven by a named command, test, or captured browser check.

## Known limitations to keep honest

- Physical review of the content is editorial only; the UI never claims expert verification.
- Localization is modelled (ru required, en optional) but the MVP UI is Russian only.
- Solving is single-occurrence; no general symbolic algebra.
- Offset units are supported by the engine but not seeded.
- No backend, accounts, sync, or persistence; state lives in the URL hash and memory.