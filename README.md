# Ultimate Calculator

A privacy-first, browser-based calculator built with vanilla HTML, CSS and JavaScript. It brings everyday arithmetic and a set of scientific and developer-oriented tools into one responsive interface.

All calculations run locally in the browser. The app does not require a backend, account or calculation API.

## Features

- **Basic calculator:** arithmetic, parentheses, operator precedence, percentages, previous answer, memory controls and keyboard input.
- **Scientific calculator:** trigonometric and hyperbolic functions, inverse functions, logarithms, roots, powers, factorials, constants and degree/radian mode.
- **Graphing:** plot multiple functions, zoom and pan, inspect coordinates and visualize equation roots.
- **Function Lab:** explore supported functions with preset inputs and degree/radian controls.
- **Unit converter:** length, area, volume, mass, temperature, time, speed, data, energy and pressure.
- **Statistics:** descriptive statistics with population and sample variance modes.
- **Programmer tools:** binary, octal, decimal and hexadecimal conversion plus 32-bit bitwise operations.
- **Equation solver:** linear and quadratic equation solving with graphing support.
- **Percentage and finance tools:** percentage-of, percentage change, increase/decrease, simple interest, compound interest and payment estimates.
- **Themes:** light, dark and system appearance.
- **Progressive Web App:** installable app shell with service-worker caching for supported browsers.

The calculator currently has **session-only memory controls, not a persistent calculation-history feature**.

## Technology and privacy

- HTML5, CSS and vanilla JavaScript
- No runtime dependencies
- No backend or database
- No login requirement
- No calculation API
- Static deployment; Vercel configuration is included
- Expression parsing is implemented in JavaScript without `eval()`

## Run locally

Requirements: Node.js 22 or compatible current LTS.

```bash
npm install
npm start
```

Open the local URL printed by the server (default: http://127.0.0.1:4173).

You can also serve the project with another static HTTP server, for example:

```bash
python3 -m http.server 4173
```

Then visit http://localhost:4173. A local server is recommended for service-worker testing; direct `file://` access does not provide the same browser behavior.

## Tests

Install the Playwright browser once:

```bash
npx playwright install chromium
```

Run checks:

```bash
npm run lint
npm test
```

The Playwright suites cover startup, arithmetic precedence, theme switching, unit conversion, statistics, graph-mode visibility, expression precedence, implicit multiplication, percentages, factorials, degree/radian functions, common calculation errors, programmer bitwise operations, equation solving, finance outputs, converter swapping, graph controls, keyboard input and a narrow mobile viewport. These are regression gates for the covered cases, not exhaustive proof of every mathematical edge case. GitHub Actions runs the same checks on pushes to the upgrade branch and on pull requests to `main`.

## Project structure

```text
index.html              Application markup
style.css               Theme tokens, layout and component styling
app.js                  Application state, feature logic and UI events
src/core/calculator-engine.js  Tokenizer, parser, evaluator and number formatting
manifest.json           PWA manifest
service-worker.js       Offline app-shell caching
icon.svg                App icon
vercel.json             Static deployment configuration
tests/
  static-server.mjs     Local server used by browser tests
  e2e/smoke.spec.js     Playwright application smoke tests
  e2e/expression-engine.spec.js  Calculation grammar and error regressions
  e2e/features.spec.js  Tool, keyboard and responsive regressions
  e2e/pwa.spec.js       Offline app-shell regression tests
  unit/calculator-engine.test.js  Pure engine unit tests
playwright.config.js    Browser-test configuration
docs/
  audit-baseline.md     Source audit and baseline risks
  architecture.md       Incremental target architecture
CONTRIBUTING.md         Local development and contribution checks
```

The first low-risk architecture step is complete: the expression engine is a native ES module, while the remaining UI and feature orchestration stays in `app.js` for a gradual follow-up migration. The PWA test verifies that the extracted engine is cached for offline use.

## Roadmap

1. Expand calculation-engine and feature regression coverage.
2. Extract remaining feature logic behind tested boundaries without changing expression semantics.
3. Refine responsive and accessible UI states across themes and viewport sizes.
4. Verify PWA installation, offline reload and cache updates.
5. Complete release review and document any remaining limitations.

## Engineering documentation

- [Repository audit and baseline risks](docs/audit-baseline.md)
- [Architecture direction](docs/architecture.md)
- [Design system specification](docs/design-system.md)
- [Upgrade roadmap and release gates](docs/upgrade-roadmap.md)
- [Contribution workflow](CONTRIBUTING.md)
- [Changelog](CHANGELOG.md)

## Deployment

Deploy the repository as a static site on Vercel or another static hosting provider. No server-side runtime is required for calculation features. After changing asset paths, test the deployed URL and service-worker behavior.

## Author

Created and maintained as a personal frontend and JavaScript project by [Utsav Adhikari](https://github.com/utsavadhikari001).

---

Built with HTML, CSS and JavaScript.
