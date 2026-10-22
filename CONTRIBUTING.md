# Contributing

## Principles

- Preserve current calculator features unless a change is explicitly planned and tested.
- Keep the app client-side and compatible with static hosting.
- Prefer small commits over a full rewrite.
- Never use `eval()` or `new Function()` to evaluate calculator expressions.
- Include tests for bug fixes and new behavior.
- Do not add a runtime dependency without explaining why it is needed.

## Local development

Requirements: Node.js 22 or a compatible current LTS release and npm.

```bash
npm install
npm start
```

Open the local URL printed by the server (default: http://127.0.0.1:4173).

## Checks

```bash
npm run lint
npx playwright install chromium
npm test
```

The Playwright suite starts its own static server. Tests run with service workers blocked so stale caches do not hide the latest source during ordinary UI checks. PWA lifecycle behavior should be tested separately.

## Pull requests

- Explain the behavior change and the reason for it.
- List manual verification performed and any limitations.
- Add or update regression tests.
- Check mobile layout, keyboard use and light/dark/system themes for UI changes.
- Keep README claims consistent with the actual app.
