# Changelog

## Unreleased — Professional upgrade

- Added repository audit, architecture direction, design-system guidance and release gates.
- Added Playwright smoke, feature and expression regression suites plus Node unit tests.
- Extracted the expression tokenizer, parser, evaluator, numeric guards and formatting into a native ES module at `src/core/calculator-engine.js`.
- Kept the application on vanilla HTML, CSS and JavaScript with static hosting and no runtime framework.
- Refined semantic light/dark/system theme tokens and aligned browser/PWA theme colors.
- Versioned the service-worker cache and included the extracted engine in the offline app shell.
- Preserved existing calculator modes and workflows; further behavior changes remain gated on regression coverage.
