# Changelog

## Unreleased

- Rename the package and repository to `opencode-prompt-optimization` (plugin id `prompt-optimization`); command ids are now `prompt-optimization.*` and the settings page id changed accordingly.
- Document the npm and `opencode plugin add` installation methods in both READMEs.
- Move the expand entry point to the composer toolbar: an icon button left of the send button, with the **Optimize prompt** / 「提示词优化」 tooltip.
- Remove the composer pill and the bottom fallback button; the toolbar button is mounted with a best-effort DOM injection that re-places itself after host re-renders.
- Expand prompts that contain `@` references or a leading `/command`: references are masked as placeholders, left untouched by the model, and restored verbatim.
- Remove the `skipOnMentions` option and the "contains @ references, skipped" toast.
- Show a loading effect on the toolbar icon while an expansion is running: a rotating gradient ring around the sparkle plus a breathing star, driven by SVG SMIL with a repeat-click guard; when the animation is turned off in Settings > Prompt Optimization, a static ring and button tint still show the busy state.
- Track three toolbar states (`idle` / `loading` / `success`): the button is disabled while loading, then shows a green check with an elastic pop for 1.5 s after a successful expansion; failures return straight to idle.
- Make the composer itself show the state: a rotating conic-gradient "star river" border and a purple-blue glow while loading (painted on the host's `form[data-component="composer"]` through `::before` and `@property --pe-angle`), then a one-shot green glow when the text was replaced.
- `expand()` / `regenerate()` now resolve to `"done" | "skipped" | "failed"` (`ExpandOutcome`) instead of `void`, so the toolbar can react; command-palette callers ignore the value and behave as before.
- Redesign the settings page: title/subtitle header with an unbound-shortcut pill, inline rows with switch controls, and a full-width model picker. The picker searches connected providers and models in a two-column popover, offers `auto` / `composer` / empty presets, and accepts a typed `provider/model`.
- Add the `catalog` RPC so the GUI reads the provider catalog through a public plugin API; models carry a context-size label plus reasoning/fast tags.
- Drop the `settings.note` line and the "(experimental)" suffix on the outline setting (now a badge).
- Add a Thinking selector to the model picker toolbar: the chosen variant (e.g. `low` / `high`) is passed through to the model request, and empty follows the composer; `catalog` now reports each model's `variants`.
- Stop skipping short drafts that carry a reference: the length check now counts the whole draft, so `优化 @src/app.ts 的代码` expands.
- End a reference at CJK/ASCII punctuation, so `请检查 @src/app.ts，再修复登录` no longer hides the rest of the sentence inside the reference.
- Clear a stale Thinking variant when the newly picked model does not offer it, and retry the catalog load after a failure instead of caching the empty result.
- The Settings animation toggle now also gates the composer glow, independent of the OS reduced-motion setting; a thrown expansion returns the toolbar to idle.

## 0.2.0

- Add an experimental **session outline** panel: user messages on the right, click to scroll, active entry highlight, load-earlier and jump-to-latest controls.
- Add the `outline` option and a settings toggle; it is off by default.
- Add the `prompt-optimization.outline` command and a side panel `+` menu entry.
- Enabling the outline opens its tab immediately; the `+` menu entry and command work before the host stores the tab id, and closing the tab keeps it closed.
- Message lookup uses the timeline's `data-message-id` rows and `message-<id>` anchors; a miss shows a toast instead of guessing.
- Unrendered messages are located by bisecting the virtualised timeline's scroll offset, loading a page when the search reaches the oldest loaded message.
- Jumps scroll instantly so the host's follow logic cannot cancel them, and only rows inside the timeline scroller are considered.
- Unrendered targets are reached through the app's own `message.previous` / `message.next` commands, which unpin auto-follow and reveal the message; scroll bisection remains the fallback.
- Add tests for title extraction, outline building, and active-row selection.

## 0.1.1

- Fix the npm package README so the English README is primary.
- Move the Chinese README to `docs/README.zh-CN.md`.
- Update the npm install instructions after the first publish.

## 0.1.0

- Initial OpenCode Desktop GUI plugin.
- Expand, regenerate, undo, restore, and version navigation commands.
- Composer pill for mounted sessions.
- Best-effort bottom button and DOM fallback for Home / new-session drafts.
- Settings page for mode, model, and project context.
- Project context from package.json, rule files, and git status.
- OpenAI/Claude-family prompt variants.
- Unit tests and a stubbed GUI smoke test.
