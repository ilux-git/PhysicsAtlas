# Architecture decisions

Short records; each state the decision, why, and what it costs.

## ADR-001 — client-only React + Vite + TypeScript

**Decision.** Ship a static client application. No backend, no database server, no auth.
**Why.** The knowledge base is small, versioned content; the product is exploration and
computation. §12 of the requirements forbids unneeded infrastructure.
**Cost.** Content ships with the bundle; edits require a rebuild. Acceptable for the MVP.

## ADR-002 — the JSON knowledge base is the single source of truth

**Decision.** Physics facts live only in `src/knowledge/data/*.json`. Graph edges, equation
`variables`, law `equationRefs`, and search indexes are derived at load time.
**Why.** §8 requires that graph and cards not restate what the knowledge base already
says; duplicated facts drift.
**Cost.** Load-time derivation code and its tests; the derived data is not hand-editable,
which is the point.

## ADR-003 — AST is canonical, LaTeX is presentation

**Decision.** Equations store `lhsAst`/`rhsAst`; `displayLatex` is for rendering only. The
validator converts the supported LaTeX subset back to the parser's infix syntax and requires
structural equality with the stored AST; symbol presence alone is never proof.
**Why.** §5 forbids LaTeX as the only mathematical semantics, and a display can have the right
letters with the wrong operators (`F = m + a` for `F = ma`).
**Cost.** Authors must stay inside a documented LaTeX subset; unsupported markup is a build error.

## ADR-004 — computed statuses are separate from authored statuses

**Decision.** `review.formulation`, `review.expert` and `conditionsStatus` are authored;
`structuralStatus` and `dimensionalStatus` are computed. `review.expert: completed` requires a
named reviewer, date and source. There is no single `valid` field.
**Why.** §6 and §7 require independent statuses; a computed check must not be confused with a
physical review. A dimensionally valid `F = 2ma` must not look approved.
**Cost.** The UI shows separate chips; path results carry three independent characteristics.

## ADR-005 — deterministic hand-written SVG map instead of a graph library

**Decision.** Lay out the selected object's neighbourhood on BFS rings with a stable
angular order; render SVG with view-state pan/zoom. No force simulation, no graph library.
**Why.** §10 asks for a local neighbourhood, not a whole-KB hairball; deterministic layout
is testable and keeps dependencies minimal.
**Cost.** No physics-based aesthetics; expansion recomputes the layout.

## ADR-006 — Russian UI, localisation-ready data

**Decision.** All user text is Russian. Localized fields are `{ru, en?}` with `ru`
required; English coverage is partial and documented as an unfinished capability.
**Why.** The audience is Russian school students 7–11 (§1); §4 still requires one canonical
object with localized fields rather than duplicated English entities.
**Cost.** No language switcher in the MVP; en content is incomplete.

## ADR-007 — limited algebra, no CAS

**Decision.** Solve for a variable only when it occurs once and every step is invertible;
otherwise report a typed failure. `x² = c` is refused as `multiple-solutions`, never solved
by picking one root. Domain constraints are collected from both sides before any inversion.
**Why.** §5 and §9 ask for basic transformations and honest limits; silently dropping a root
or a denominator restriction is worse than refusing.
**Cost.** Some textbook problems (quadratic, variable on both sides, simultaneous equations)
are refused with a reason; documented and surfaced in the UI.

## ADR-008 — review status wording

**Decision.** Formulation origin is `standard-school/definition/derived/draft`; expert review is
a separate field `none/requested/completed/rejected`. All seed records are `expert: none`. The UI
says the formulation is standard and that expert review has not been done.
**Why.** §7 forbids marking unconfirmed physics as verified.
**Cost.** All content displays a review caveat; `completed` needs real reviewer data that does not
exist yet.

## ADR-009 — one workspace, URL hash, no router

**Decision.** The application has a single screen; selected node, level, domain, radius and tab
live in the URL hash. There is no router dependency, and no persistence.
**Why.** §10 describes one exploration screen; deep-linkable cards make the atlas shareable.
A router would add states and a dependency the product does not have.
**Cost.** In-app navigation does not create back/forward entries; state resets when the URL is
replaced.

## ADR-010 — no persistence or accounts

**Decision.** Nothing is stored beyond the current tab (URL hash). No localStorage, accounts,
sync or backend.
**Why.** §12 forbids a backend without justification; §3 rules out profiles without proven
need. Exploration is a reading activity, not a course with progress tracking.
**Cost.** User-supplied values and condition decisions reset on reload.

## ADR-011 — machine-checked edge contracts

**Decision.** Every relation kind declares allowed source/target kinds, origin and direction in
`EDGE_REGISTRY`; the validator rejects edges that violate it. `derived_from` is explicitly
target equation → source equation.
**Why.** PROMPT-2 §9 requires unambiguous graph semantics, not convention.
**Cost.** New relation kinds require a registry entry and tests.

## ADR-012 — one fixed grammar for formulas

**Decision.** Juxtaposition (implicit multiplication) binds tighter than `*` and `/`; unary minus
is lower than power; exponents are integer literals. The printer parenthesises by precedence.
**Why.** `a / b c` must not silently mean `(a/b)·c`.
**Cost.** Some alternative spellings are rejected; the grammar and examples are documented and
tested.

## ADR-013 — path characteristics are independent

**Decision.** A path carries `computation`, `conditionsStatus` and `review` separately. Review
never improves because dimensions match or conditions were confirmed; ranking ignores it.
**Why.** PROMPT-2 §4: “computable” must not read as “physically verified”.
**Cost.** The UI has three status blocks instead of one badge.
