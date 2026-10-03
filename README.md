# Clear Calculator

A polished, responsive calculator built only with HTML, CSS, and vanilla JavaScript. It is a static site: arithmetic, scientific functions, graphs, conversions, and tools run entirely in the browser. There is no calculation API, backend, login, database, analytics, or saved calculation history.

## Run locally

Open `index.html` directly for the calculator, or serve this directory over HTTP to test the offline/PWA service worker:

```sh
python3 -m http.server 4173
```

Then visit `http://localhost:4173`. The Python command is only a local static-file preview; the project has no server-side application.

## Deploy to Vercel

Import this repository as a static project in Vercel. No build command, output directory, Node runtime, or environment variables are required. The files at the repository root are served directly.

## What is included

- Basic arithmetic with parentheses, precedence, percentages, sign toggle, backspace, `Ans`, and copy.
- Scientific functions, factorial, constants, inverse and hyperbolic trig, powers and roots, modulo, and an always-visible DEG/RAD selection in Scientific mode.
- Function Lab with direct `sin(0°)`, `sin(1°)`, and other angle presets, plus radian presets such as π/6 and π/2.
- Session-only memory: MC, MR, M+, M−, MS.
- Unit conversion for length, area, volume, mass, temperature, time, speed, data, energy, and pressure.
- Graphing with live-updating functions, up to eight curves, DEG-independent radian plots, zoom, pan, reset, hover coordinates, and equation-root markers.
- Percentage tools, descriptive statistics (population/sample), programmer base conversion and 32-bit bitwise operations, linear/quadratic equation solving with Plot / Solve & Plot, and simple/compound interest estimates.
- Keyboard input, responsive layout, Light/Dark/System themes, accessible status updates, and reduced-motion support.
- Optional PWA shell caching for offline use after the first visit. The service worker caches only static app assets, never calculations.

## Calculation engine

`app.js` tokenizes expressions, parses them into a small expression tree, then evaluates that tree. It does not use `eval()` or send expressions over the network. Calculation state, `Ans`, memory, theme selection, and current tool inputs exist only in the active page session.
