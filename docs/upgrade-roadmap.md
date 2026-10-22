# Professional upgrade roadmap

## Working rules

- Work on `upgrade/professional-baseline` or a follow-up feature branch, never directly on `main` for broad refactors.
- Merge small, reviewable pull requests only after CI passes and the owner reviews the change.
- Capture current behavior before changing calculation semantics.
- Keep the production app as vanilla HTML/CSS/JavaScript on static hosting.
- New features do not outrank correctness, accessibility, offline reliability or preservation of existing features.

## Milestones

| Milestone | Estimated effort | Deliverables | Exit criteria |
| --- | --- | --- | --- |
| M0 — Audit and baseline | 2–3 days | Audit, docs, smoke tests, CI | CI is green; baseline workflows pass |
| M1 — Calculation correctness | 4–6 days | Focused parser/evaluator tests and explicit numeric/error rules | Core arithmetic and edge-case suite passes |
| M2 — Design system | 4–6 days | Semantic tokens, typography/spacing, component states, responsive polish | Light/dark/system, keyboard focus and mobile checks pass |
| M3 — Incremental architecture | 5–8 days | Extract pure core modules, then UI/features behind tests | Existing modes remain functional; no `eval`/dynamic code |
| M4 — Feature hardening | 4–6 days | Graph, converter, statistics, programmer, equation and finance regression tests | Each major feature has focused regression coverage |
| M5 — PWA and release | 2–4 days | Cache/update review, accessibility sweep, deployment checks, release notes | Offline/update checks pass; documentation matches shipped behavior |

**Planning estimate:** roughly 3–5 focused weeks depending on how many edge cases are uncovered. This is a planning range, not a promise; correctness issues discovered in M1 may extend the schedule.

## Safe implementation sequence

1. Record the base commit and audit findings.
2. Add browser smoke tests and CI before changing UI or calculation logic.
3. Run CI; fix baseline-test defects without changing app semantics.
4. Add focused calculation-engine tests around precedence, unary operators, functions, percentages, factorial, invalid input and finite results.
5. Centralize design tokens and responsive states in a dedicated styling pass.
6. Extract pure tokenizer/parser/evaluator/formatting modules without changing the accepted expression grammar.
7. Move feature logic one boundary at a time, retaining compatibility and tests.
8. Review PWA cache invalidation and static hosting paths after any file move.
9. Run the full browser suite and manual accessibility/responsive checks.
10. Update README, changelog and repository About text only to describe features that exist and have been verified.

## Feature priority

**Protect first:** arithmetic/scientific correctness, graph rendering, keyboard workflows, converter category coverage, statistics, programmer operations, equation solving, finance calculations, themes and PWA behavior.

**Add only after stability:** optional local calculation history, precision/display controls, reusable formulas/variables and graphing quality-of-life improvements. Any history feature must clearly state where data is stored and provide a clear-all action.

**Out of scope for this upgrade:** mandatory backend, account system, cloud sync, analytics, AI features, large frameworks, or replacing the expression engine without compatibility evidence.

## Release gates

- CI passes on the pull request head.
- Core parser/evaluator tests cover normal inputs and error boundaries.
- No uncaught console errors in smoke-tested workflows.
- Keyboard and focus behavior remain usable.
- Mobile layout and all theme modes are checked.
- PWA install/offline/update behavior is tested after asset changes.
- README, PWA manifest, metadata and shipped UI use consistent branding.
- No unreviewed feature removal or direct push to `main`.
