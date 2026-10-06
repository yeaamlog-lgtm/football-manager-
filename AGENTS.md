## Cursor Cloud specific instructions

### Project overview

Browser-based Football Manager game — pure vanilla JS, HTML, CSS. Zero dependencies, zero build tools, zero backend. All logic runs client-side.

### How to run

Serve the repo root as static files on port 5501 (matches `.vscode/settings.json` Live Server config):

```
python3 -m http.server 5501
```

Then open `http://localhost:5501/` in Chrome.

### Architecture

- No `package.json`, no `node_modules`, no bundler — all JS loaded via `<script>` tags in `index.html` sharing global scope.
- Script load order matters: `dataEPL → dataLaLiga → dataSerieA → dataBundesliga → dataLigaPortugal → engine → season → manager → ui → script`.
- Game state lives in a global `gameState` object; save/load uses `localStorage`.

### Lint / test / build

- No linter, test framework, or build step configured. Validation is manual: serve and test in browser.
- The `CLAUDE.md` and `MEMORY.md` files contain project conventions and current state — read them before making changes.
