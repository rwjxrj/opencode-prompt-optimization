# AGENTS.md

OpenCode Desktop GUI plugin: a server half plus a SolidJS GUI bundle. `@opencode/plugin` is pinned to `2.2.5`; the Desktop GUI plugin API is experimental.

## Commands

- `npm run verify` — typecheck + vitest + build + GUI smoke. Run it before claiming done.
- Single test: `npx vitest run test/optimizer.test.ts` (vitest, Node environment, no DOM).
- `npm run smoke:gui` loads `dist/gui-experimental.cjs`, so run `npm run build` first; `verify` already orders it correctly.
- Add new server-side `.ts` files to the explicit `include` list in `tsconfig.server.json`, or they are not emitted to `dist/`.
- In PowerShell, piping `npm test` can report exit 1 from expected stderr. Use `cmd /c "npm run verify & echo EXIT:%errorlevel%"` when the exit code matters.

## Boundaries

- GUI must not call a model directly; it goes through the `optimize` / `catalog` RPC in `src/rpc.ts`.
- Server must not touch the composer DOM.
- The GUI has no provider/model catalog API; the settings picker reads it from the `catalog` RPC (server uses `ctx.provider.list()` + `ctx.model.list()`).
- Styling is registered with `ctx.add(Style, css)`. Call it before the `typeof document === "undefined"` guard (Node smoke needs it); never append a `<style>` tag by hand.
- i18n keys and the prefs schema live only in `src/gui/definition.ts`; add every key to both `en` and `zh`.
- User-visible behavior: update `README.md`, `docs/README.zh-CN.md`, and `CHANGELOG.md`; keep `AGENTS.md` current when commands or host markup change.

## Composer integration (host internals)

- No composer-toolbar slot exists. `src/gui/toolbar.ts` injects a button using `[data-action="composer-submit"]` inside `[data-slot="composer-actions"]`, inserting before the send anchor, and re-places it with a `MutationObserver`.
- Composer busy states are painted on `form[data-component="composer"]` via `data-pe-state`; the button uses `data-state`.
- Home / draft pages have no mounted session, so `src/gui/draft.ts` falls back to the bottom-most contenteditable.
- These selectors and the session-outline timeline attributes (`data-message-id`, `message-<id>`) are undocumented host markup. Re-check them after any Desktop upgrade.

## References and expansion

- `maskReferences` / `restoreReferences` in `src/optimizer.ts` replace `/command` and `@path` with `[[refN]]` placeholders; only prose is rewritten. A reference ends at whitespace or CJK/ASCII punctuation. If a placeholder is missing, duplicated, or renamed, do not write back.
- `shouldSkip` masks internally and counts length on the raw draft, so a short instruction next to a reference still expands.
- `controller.expand()` returns `ExpandOutcome` (`"done" | "skipped" | "failed"`); the toolbar turns `"done"` into the success state.
- Settings prefs are optional (`Store.global`); read them as `prefs.value.x ?? default`.

## UI notes

- Plugin settings pages render inside `.settings-panel` without the host's `.settings-tab-body`, so the page supplies its own `40px` inline padding and a `80px` bottom inset.
- Host design tokens are `--v2-*`; keep fallbacks because the names are not public API.
- Styled `<select>` uses `appearance: base-select`; `::picker-icon { position: absolute }` needs `position: relative` on the select.
- The Settings animation toggle gates the SMIL ring and the CSS star/composer-glow animations; `prefers-reduced-motion` is intentionally ignored because the toggle is an explicit user choice.

## Environment gotchas

- Files are UTF-8. PowerShell 5.1 `Set-Content` writes ANSI and corrupts Chinese text and symbols — use the editor tools.
- Desktop loads this plugin from the global `~/.config/opencode/opencode.jsonc` by local path. The GUI bundle is read at window start: reload the window after a build.
- `dist/`, `node_modules/`, `.codegraph/` are ignored; do not commit them. The CodeGraph index exists — run `codegraph sync` after large refactors.