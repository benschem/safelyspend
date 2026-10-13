# The dev console is noisy on `/login`

- **Status:** not started. Seen 2026-10-10.
- **Goal:** the dev console on `/login` is quiet enough that a real error stands out.
- **Touches:** `index.html`, and a `Select` not yet traced.

Seen in Firefox at the start of the Phase 7 two-browser walkthrough, 2026-10-10.
None of it broke anything, but four lines of standing noise make a real error
easy to miss. Only the last is known to be the app's own.

- **`/pa-stats/js/script.manual.js` fails to load.** Expected: the proxy is a
  Netlify redirect and does not exist in dev (`DEVELOPMENT.md` says so). To
  quieten it, leave the script tag out of the dev page.
- **A source map error for `installHook.js.map`.** The React DevTools extension,
  not the app. Nothing to fix; listed so nobody chases it.
- **The CSP blocks an `eval` at `util.js:157`** (`script-src` has no
  `unsafe-eval`, on purpose). Source not traced. Most likely an extension or a
  dev-only dependency. Check whether it appears in a clean browser profile and
  in a production build before deciding it matters; the answer is never to add
  `unsafe-eval`.
- **"Select is changing from uncontrolled to controlled."** A real React
  warning: some `Select` starts with an undefined value and is given one later.
  Not traced to a component. Give it a defined initial value.
