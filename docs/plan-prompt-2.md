# PROMPT-2 — correctness and reliability plan

Source: [`PROMPT-2.md`](../PROMPT-2.md). Audit evidence: [`audit-2026-11-22.md`](audit-2026-11-22.md).

This plan is the implementation contract for the reliability phase. It preserves the architecture
(React/Vite/TypeScript, JSON knowledge base, Zod, AST, deterministic graph, no backend/CAS) and does
not start new content until the core gates pass.

## Implementation status (2026-11-22)

Stages 0–9 are implemented on `feat/physics-atlas-mvp`; stage 10 reconciles documentation and
captures browser proof. Current state: 77 entities, 130 edges, 2 domains, 159 tests passing,
`validate`/`typecheck`/`build` green. All seed reviews remain `expert: none`. Priority C is a
proposal only ([`content-plan-kinematics.md`](content-plan-kinematics.md)).
## 1. Baseline

At commit `d324112`: `pnpm validate` 77/129/2 with 0 errors, `pnpm typecheck` clean,
`pnpm test` 119/119 in 15 files, `pnpm build` succeeds (729 kB / 208 kB gzip). Browser smoke
confirmed the production build renders. The counts are rechecked in the audit, not trusted from
previous reports.

## 2. Findings and remediation order

| ID | Severity | Problem | Fix |
|---|---|---|---|
| P0-1 | critical | one path status mixes computation, conditions and review; review is duplicated | split formulation and expert review; independent path statuses |
| P0-2 | critical | `x² = c` silently returns one root | explicit `multiple-solutions` / `no-real-solutions` |
| P0-3 | critical | display not structurally checked; infix printer drops parentheses | strict LaTeX-subset parse + precedence-aware printer |
| P0-4 | critical | domain restrictions outside the inverse path are lost | collect domain constraints from both sides |
| P0-5 | critical | derivation `verified` has no criterion | restrict to `draft | structural` |
| P1-1 | high | implicit multiplication precedence undocumented/ambiguous | fix juxtaposition precedence, document, test matrix |
| P1-2 | high | alternative forms weakly checked | variable-set and display checks |
| P1-3 | high | no edge-type contract | `EDGE_REGISTRY` + validator + tests |
| P1-4 | high | `P = UI` context unspecified | direct-current condition + explicit note |
| P1-5 | high | conditions not attributed; hidden unverified constraints | `requiredBy`, `unverifiedConstraints`, conditions gate |
| P1-6 | high | docs contradict code | rewrite affected docs |
| P2-1 | medium | no back history, no “why this node”, tool draft resets | small UI fixes |
| P2-2 | medium | no systematic dimension/unit matrix | audit matrix + fixes only if proven |

## 3. Semantic model

### Review

```ts
type FormulationKind = 'standard-school' | 'definition' | 'derived' | 'draft';
type ExpertReviewStatus = 'none' | 'requested' | 'completed' | 'rejected';
interface Review {
  formulation: FormulationKind;
  expert: ExpertReviewStatus;
  reviewer?: string;
  reviewedAt?: string;
  note?: LocalizedText;
}
```

- Every entity JSON record migrates to `review: { formulation, expert }`.
- `Equation.physicalReview` is removed.
- Seed values: `standard-school`/`none`; equations that are rearrangements are `derived`,
  definitional equations are `definition`. No seed record is `completed`.
- Validator: `completed` requires reviewer, valid `reviewedAt` and a source; `rejected` requires a
  note. Computed checks never raise `expert`.
- Derived verification becomes `draft | structural`; `verified` disappears from the type/schema/UI.

### Find Path

`PathResult.status` is replaced by:

- `computation.status: 'numeric' | 'symbolic' | 'failed'` + messages;
- `conditionsStatus: 'not-required' | 'confirmed' | 'partial' | 'unconfirmed' | 'violated'`;
- `review: { formulation, expert, perEquation[] }`.

The UI shows three separate blocks and never a single «допустимый» label. Ranking uses computation
failure, condition violations, unconfirmed count and step count only; review never improves rank.
Each `PathCondition` gains `requiredBy` equation IDs. Unmapped solver constraints become
`unverifiedConstraints` and prevent `confirmed`.

### Display and AST

New `src/engines/ast/latex.ts` converts the supported display subset (`\frac`, `\sqrt`, `\cdot`,
`\times`, `\left`, `\right`, `^{n}`, braces, unicode operators) to infix; unknown commands error.
The validator parses every `displayLatex` and every alternative form and requires AST equality with
the stored AST. Alternative form variable sets must equal the primary set. `astToInfix` becomes
precedence-aware and is round-trip tested. `astEquals` compares constant values, not names.
Authored school-facing LaTeX stays; there is no automatic LaTeX generator.

### Parser

Precedence, low to high: `+ -`, `* /`, implicit multiplication, unary `+ -`, `^` (integer ±12),
atoms/`sqrt`. Therefore `a / b c = a/(b·c)`, `m a / t = (m·a)/t`, `-a^2 = −(a²)`,
`(-a)^2 = (−a)²`, `a^-2` accepted, `a^2^3` rejected, `ma` is an unknown symbol. No code execution.

### Solver

Failure codes: `target-absent`, `target-multiple`, `multiple-solutions`, `no-real-solutions`,
`unsupported-power`, `domain-violation`, `unsupported-operation`.

- Support add/subtract/negate/multiply/divide (both positions), power 1, principal `sqrt(x)=c` for
  `c ≥ 0`.
- `x² = c`: refuse with `multiple-solutions` (± roots); negative constant c → `no-real-solutions`.
- Other powers, including negative exponents: explicit `unsupported-power`.
- Collect domain constraints from **both sides**: denominator ≠ 0, `sqrt` argument ≥ 0, negative
  power base ≠ 0. Merge with inverse preconditions, dedupe.
- Tests verify the solved AST by substitution at sampled in-domain values.

### Conditions

Conditions from all steps and laws are merged, attributed and preserved. Auto-violation for
`nonzero` at supplied zero value stays. Solvers' nonnegative constraints without a knowledge-base
condition stay explicit and block “confirmed”. UI explains which equation needs which condition.

### Graph

`src/domain/edges.ts` defines for every edge kind its allowed source/target entity kinds, origin,
Russian semantics and direction. `deriveEdges` uses it; a post-build validator reports
`edge-type-invalid`. `derived_from` remains target→source and is tested/documented. Alternative
forms are checked for variable equality. Determinism and dedupe tests stay.

### Units and dimensions

No model expansion. Add an audit matrix for all operations, dimensionless values, invalid
factors/offsets, cross-group conversion, offset conversion, and numeric path conversion into a
requested target unit. Fix only proven defects.

### Content

- `P = UI`: add `cond.steady-current` and an explicit note that the atlas models direct current;
  average AC power needs a power factor and is not modelled.
- `A = Fs`, `v = s/t`, `F = ma`, `Q = It`: explicit form notes for angle, uniform-vs-average,
  vector magnitude, and integral/general case; keep conditions.
- Verify source metadata with reliable external sources; never invent pages, ISBNs or quotes.
- Review level 7–8/9/10–11 texts; keep every applicability condition.
- No entity is marked as expert-reviewed.

### Investigation UI (priority B)

Selection history with a visible «Назад»; hop distance and relation kind in node/edge explanations;
Inspector relations grouped by edge kind; Find Path draft (target, known rows, depth, condition
decisions) kept across tab switches in session context. No unrelated features.

## 4. Stages and gates

Each stage is one commit on `feat/physics-atlas-mvp`. Gate: `pnpm validate`, `pnpm typecheck`,
`pnpm test`, `pnpm build`, plus the stage-specific tests. A failing behavior is captured before the
fix where practical. No trunk commits.

| Stage | Deliverable |
|---|---|
| 0 | audit report, PROMPT-2 committed untouched, four commands + browser smoke |
| 1 | review split, JSON migration, equation/path review UI, status tests |
| 2 | parser precedence, printer, grammar docs/tests |
| 3 | strict display parsing, alternative form checks, tests |
| 4 | solver codes, multi-root refusal, domain collection, substitution tests |
| 5 | condition attribution, independent path statuses, UI/tests |
| 6 | dimension/unit audit matrix and fixes |
| 7 | edge registry, direction contracts, relation UI/tests |
| 8 | content fixes, source verification, level pass |
| 9 | back history, why-node/relation explanations, draft persistence |
| 10 | docs reconciliation, full browser proof, final report; kinematics proposal only |

## 5. Acceptance

1. AST and display agree structurally.
2. Parser grammar is fixed, documented and tested.
3. No root or domain restriction is dropped silently.
4. Dimensional validity never raises expert review.
5. Conditions remain attached and attributed through multi-step paths.
6. Path UI shows computation, conditions and review separately.
7. Graph edge semantics/directions are registry-checked.
8. Units never mix different physical groups.
9. New entities validate (content expansion deferred to a separate proposal).
10. UI shows limitations/errors truthfully.
11. Docs match code.
12. Four commands pass after every stage or a failure is documented.

## 6. Constraints

No new dependencies. No backend, accounts, CAS, graph DB, simulations or LMS. Priority C content is
a proposal (canonical modeling of initial velocity/deltas) and requires approval before
implementation. Browser proof is Chromium + ARIA/text inspection; screenshots are captured but a
language model cannot visually judge them.