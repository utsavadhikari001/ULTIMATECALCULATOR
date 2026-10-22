# Architecture direction

## Constraints

- Keep the application deployable as a static site.
- Use vanilla HTML, CSS and JavaScript (native ES modules are allowed).
- Keep all calculations in the browser; no backend, login, analytics or mandatory cloud service.
- Preserve the existing calculator modes and tools while refactoring.
- Do not use `eval()` or `new Function()` for expression evaluation.

## Target shape

Move in small, reviewable steps toward the following layout. Existing root files remain in place until a migration step has tests and a working static-hosting check.

```text
index.html
src/
  main.js
  core/
    tokenizer.js
    parser.js
    evaluator.js
    number-format.js
  state/
    calculator-state.js
  ui/
    calculator-view.js
    theme-controller.js
    mode-controller.js
  features/
    graph/
    converter/
    statistics/
    programmer/
    equation-solver/
    finance/
styles/
  tokens.css
  base.css
  layout.css
  components.css
  features.css
tests/
  e2e/
docs/
  architecture.md
  audit-baseline.md
```

This is a target, not a requirement to create every file immediately. Extract code only when there is a clear boundary and the existing behavior is covered.

## Dependency direction

- `core` modules are pure wherever practical and do not query the DOM.
- `features` consume core functions and expose small, testable operations.
- `state` owns application state and any versioned local persistence.
- `ui` binds DOM events to state/features and renders accessible output.
- `main.js` composes modules and starts the application.
- No feature should reach into unrelated feature DOM nodes.

## Calculation-engine contract

Keep tokenization, parsing and evaluation separate from display formatting. Preserve current accepted syntax until tests and explicit product decisions justify a change. Add tests for precedence, unary minus vs exponentiation, implicit multiplication, function arity, degree/radian behavior, factorial constraints, percentages, invalid characters, incomplete expressions, division by zero and non-finite results.

The evaluator should report predictable, user-safe errors. Formatting is presentation; it must not silently change the stored numeric value. Financial rounding policy should be explicit rather than inferred from display strings.

## State and persistence

Keep the current session-only memory semantics unless deliberately changed. If calculation history is introduced later, use a versioned schema and validate records read from storage. Treat imported data as untrusted. Avoid IndexedDB until history volume or query needs justify its complexity.

## UI and design system

Use CSS custom properties as the source of truth for semantic colors, spacing, radii, typography and focus rings. Keep light, dark and system themes; test contrast and focus visibility in all three. Prefer a clear calculator display, stable keypad geometry, restrained elevation and responsive layouts over decorative gradients or excessive animation. Respect reduced-motion settings and use semantic controls with explicit accessible names.

## Static hosting and PWA

Root-relative paths can break when the app is deployed beneath a subpath. Prefer the existing relative asset paths and test the production host configuration. Whenever files or paths change, update the service-worker app shell and cache version together. Test first install, offline reload, failed fetches and updates from the previous cache.

## Definition of done for a refactor

1. Existing behavior is covered by a smoke test or a focused regression test.
2. No uncaught browser-console errors on the affected workflow.
3. Keyboard and accessible names remain usable.
4. Static deployment paths and PWA caching still work.
5. The change is isolated in a reviewable commit or pull request.
