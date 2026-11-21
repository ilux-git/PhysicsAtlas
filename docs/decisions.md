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
validator warns when an AST variable symbol is missing from the display string.
**Why.** §5 forbids LaTeX as the only mathematical semantics.
**Cost.** Content authors write both forms; the validator keeps them aligned.

## ADR-004 — computed statuses are separate from authored statuses

**Decision.** `physicalReview` and `conditionsStatus` are authored content;
`structuralStatus` and `dimensionalStatus` are computed on every load and displayed with
their messages. There is no single `valid` field.
**Why.** §6 and §7 require independent statuses; a computed check must not be confused with
a physical review. A dimensionally valid `F = 2ma` must not look approved.
**Cost.** The UI shows four status chips where a single badge would be simpler.

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
otherwise report "unsupported" with a reason. Evaluation supports the AST operations and
explicit preconditions (zero divisor, even/odd roots, domains).
**Why.** §5 and §9 ask for basic transformations and honest limits, not a symbolic engine.
**Cost.** Some textbook problems (variable on both sides, simultaneous equations) are
reported unsupported; the limitation is documented and surfaced in the UI.

## ADR-008 — review status wording

**Decision.** Canonical school formulations are marked `standard-form`, never `verified`;
the UI says the formulation is standard and that an independent physical review has not
been done. The app does not claim scientific verification it cannot prove.
**Why.** §7 forbids marking unconfirmed physics as verified.
**Cost.** All content displays a caveat; the wording must stay consistent everywhere.

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