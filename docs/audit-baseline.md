# Repository audit — baseline

**Audit date:** 2026-10-22  
**Base branch:** `main`  
**Audited commit:** `ad9355d8a3dcfd40a2e9b8cf515b103632182063`

## Scope and evidence

This is a source-level audit of the repository files and markup. The application was not executed as part of the initial source review, so listed features are documented or implemented in source but are not yet claimed as runtime-verified. The new Playwright baseline is intended to establish that runtime evidence in CI.

## Snapshot

| Area | Baseline observation |
| --- | --- |
| Entry point | `index.html`, with `style.css` and a deferred `app.js` script |
| Application logic | One classic JavaScript file, about 2,088 lines, containing expression parsing/evaluation, state, UI events, graphing, conversions, statistics, programmer tools, equation solving and finance calculations |
| Markup | One HTML document, about 463 lines, with views for calculator modes and tools |
| Styling | One CSS file, about 628 lines; CSS custom properties already support light, dark and system theme selection |
| Dependencies | No runtime dependencies; original `package.json` had no scripts or test tooling |
| Hosting | Static assets with Vercel configuration; no backend required |
| Offline support | Service worker caches the app shell; cache lifecycle and update behavior need browser testing |
| Tests | No automated tests were present in the baseline |
| Documentation | README described the feature set but naming was inconsistent across README, HTML title, manifest and package metadata |

## Risks to address

1. **Regression risk:** broad features live in one script and there was no automated test suite. Add browser smoke tests before refactoring.
2. **Testing gaps:** parser edge cases, domain errors, keyboard workflows, responsive behavior, accessibility, PWA installation/offline updates and browser console errors need explicit coverage.
3. **Brand consistency:** standardize the project name and descriptions across README, page metadata, PWA manifest and npm metadata.
4. **PWA cache behavior:** review cache versioning, navigation fallback and failed network requests; test old-cache cleanup and update behavior before changing asset paths.
5. **Maintainability:** extract pure calculation functions first, then UI and feature modules gradually. Keep the parser's behavior covered by tests before moving it.
6. **Precision semantics:** JavaScript Number arithmetic is appropriate for general scientific calculations but financial outputs need documented rounding/display rules; avoid changing calculation semantics without targeted tests.
7. **History:** the current footer explicitly says there is no saved history. Any future history feature must be treated as a new feature, opt-in only if appropriate, and local-first.

## Baseline test plan

- Application boot and initial state
- Arithmetic precedence and equals interaction
- Light/dark theme switching
- Length unit conversion
- Statistics from a small data set
- Graph view and equation input visibility

Next coverage should include parser precedence and unary minus, scientific angle modes, factorial/domain errors, keyboard input, percentage and finance edge cases, programmer base conversion, graph plotting/panning, small-screen layouts, accessibility checks, and service-worker update/offline behavior.

## Audit rule

Do not remove or replace existing features based only on visual inspection. Each refactor should preserve a working main-branch snapshot and pass the smoke suite plus focused tests for the affected behavior.
