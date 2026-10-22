# Design system specification

## Design intent

Make UltimateCalculator feel like a deliberate, dependable desktop tool: calm hierarchy, legible numbers, consistent spacing, and restrained color. Do not use decorative gradients, glassmorphism, or animation that competes with the result. The calculator result and keypad remain the primary visual focus.

## Semantic color tokens

These are the proposed target tokens. Apply them in a dedicated design pass after the baseline tests are stable; do not replace colors opportunistically during unrelated bug fixes.

| Token | Light theme | Dark theme | Use |
| --- | --- | --- | --- |
| `--page` | `#F4F6F8` | `#12171D` | App background |
| `--surface` | `#FFFFFF` | `#1A2129` | Primary panels |
| `--surface-raised` | `#FFFFFF` | `#222B35` | Raised controls / menus |
| `--surface-muted` | `#E9EEF2` | `#222B35` | Quiet secondary surfaces |
| `--text` | `#202A33` | `#E7EDF3` | Primary text and result |
| `--muted` | `#5F6E7A` | `#A0ACB8` | Secondary text |
| `--border` | `#D6DEE5` | `#303B47` | Separators and outlines |
| `--accent` | `#087F73` | `#35C5B0` | Primary action / active state |
| `--danger` | `#B9384B` | `#FF7183` | Errors only |
| `--ring` | Accent with 28% opacity | Accent with 35% opacity | Keyboard focus |

Check WCAG contrast for actual foreground/background pairings before release. Never rely on color alone to communicate an error or selected state.

## Spacing, shape and type

- Use a 4 px base spacing scale: 4, 8, 12, 16, 24, 32, 40, 48 px.
- Use 8 px, 12 px and 16 px corner radii for controls, cards and major panels respectively; avoid excessive pill shapes.
- Use the system sans-serif stack for interface text and tabular numerals for results where supported.
- Use a monospace stack for expressions, equations, and programmer values.
- Results should be visually dominant; labels and status text should remain compact but readable.
- Buttons and inputs should target at least 44 px high for touch use. Do not shrink keypad targets to fit desktop density.

## Layout and responsive behavior

- **Wide desktop (1200 px and above):** centered application with a clear top navigation, stable calculator display and keypad, and tool content using the available width without excessive line length.
- **Tablet (768–1199 px):** reduce outer margins, preserve keypad geometry, wrap navigation deliberately, and keep graph controls usable.
- **Mobile (320–767 px):** single-column flow, horizontally scrollable or wrapped mode navigation, full-width tool fields, no horizontal page overflow, and touch-friendly keypad controls.
- Keep the display and keypad aligned consistently between basic and scientific modes.
- Graph canvases should resize with their container and preserve accessible zoom/reset controls.

## Interaction and accessibility

- Preserve light, dark and system modes; system mode follows `prefers-color-scheme`.
- Provide a clearly visible focus ring for keyboard users.
- Keep active tabs identifiable with text/shape as well as color and maintain `aria-selected` / `aria-pressed` states.
- Announce results and errors through the existing live regions without flooding announcements on every internal render.
- Honor `prefers-reduced-motion`; keep transitions short and nonessential.
- Do not suppress browser zoom or keyboard navigation.
- Test at 200% zoom and narrow widths, including longer expressions and large/scientific-notation results.

## Acceptance checklist

- [ ] Light, dark and system theme all render with readable text and controls.
- [ ] Focus is visible on every interactive control.
- [ ] No horizontal page overflow at 320 px viewport width.
- [ ] Keypad target size is touch-friendly.
- [ ] Result stays visually dominant without clipping for long output.
- [ ] Tool views remain usable with keyboard and screen-reader semantics.
- [ ] Reduced-motion preference is respected.
- [ ] Existing calculator behavior remains unchanged by styling-only commits.
