import { For, Show, createMemo, createSignal, onCleanup } from "solid-js"
import { SettingsPage, usePlugin, type SetupContext } from "@opencode/plugin/gui"
import type { CatalogModel, CatalogProvider, CatalogResult } from "../types.js"
import { PromptOptimization } from "../rpc.js"
import type { definition } from "./definition.js"
import { contextLabel, findModelEntry, providerColor, variantsFor } from "./catalog.js"
import { requestOutlineOpen } from "./outline.js"

type Ctx = SetupContext<typeof definition>

function ModelRow(props: {
  provider: CatalogProvider
  model: CatalogModel
  active?: boolean
  onPick: (value: string) => void
}) {
  const ctx = usePlugin<typeof definition>()
  const value = `${props.provider.id}/${props.model.id}`
  return (
    <button
      type="button"
      role="option"
      aria-selected={props.active ? "true" : "false"}
      class="pe-model-item"
      data-selected={props.active ? "true" : "false"}
      onClick={() => props.onPick(value)}
    >
      <span class="pe-model-id">{props.model.id}</span>
      <span class="pe-model-tags">
        <Show when={contextLabel(props.model.context)}>
          <span class="pe-chip">{contextLabel(props.model.context)}</span>
        </Show>
        <Show when={props.model.recommended}>
          <span class="pe-chip pe-chip--rec">{ctx.t("settings.tag.recommended")}</span>
        </Show>
        <For each={props.model.tags}>
          {(tag) => <span class="pe-chip">{ctx.t(`settings.tag.${tag}`)}</span>}
        </For>
      </span>
      <span class="pe-model-desc">
        {props.model.name === props.model.id ? value : `${props.provider.name} · ${props.model.name}`}
      </span>
    </button>
  )
}

function Settings() {
  const ctx = usePlugin<typeof definition>()
  const prefs = ctx.stores.prefs

  const [open, setOpen] = createSignal(false)
  const [query, setQuery] = createSignal("")
  const [providers, setProviders] = createSignal<CatalogProvider[] | null>(null)
  const [activeProvider, setActiveProvider] = createSignal("")

  let root: HTMLDivElement | undefined
  let loading = false

  const value = () => (prefs.value.model ?? "").trim()

  const apply = (next: string) => {
    const entry = findModelEntry(providers() ?? [], next)
    prefs.update((draft) => {
      if (draft.variant && entry && !entry.model.variants.includes(draft.variant)) draft.variant = undefined
      draft.model = next
    })
    setOpen(false)
  }

  const load = async () => {
    if (providers() !== null || loading) return
    loading = true
    try {
      const result = (await ctx.client.rpc(PromptOptimization).catalog({})) as CatalogResult
      const list = result?.providers ?? []
      setProviders(list)
      setActiveProvider((current) => (list.some((entry) => entry.id === current) ? current : (list[0]?.id ?? "")))
    } catch {
      // Keep null so the next open retries instead of latching an empty catalog.
      setProviders(null)
    } finally {
      loading = false
    }
  }

  void load()

  const openPicker = () => {
    setQuery("")
    setOpen(true)
    const list = providers() ?? []
    if (list.length > 0) {
      const index = value().indexOf("/")
      const preferred = index > 0 ? value().slice(0, index) : ""
      setActiveProvider(list.some((entry) => entry.id === preferred) ? preferred : (list[0]?.id ?? ""))
    }
    void load()
  }

  const dismiss = (event: PointerEvent) => {
    if (!root || root.contains(event.target as Node)) return
    setOpen(false)
  }
  document.addEventListener("pointerdown", dismiss)
  onCleanup(() => document.removeEventListener("pointerdown", dismiss))

  const activeEntry = createMemo(() => (providers() ?? []).find((entry) => entry.id === activeProvider()))
  const variants = createMemo(() => variantsFor(providers() ?? [], value()))
  const activeModels = createMemo(() => activeEntry()?.models ?? [])

  const direct = createMemo(() => {
    const [provider, ...rest] = query().trim().split("/")
    return provider && rest.join("/").trim() ? query().trim() : ""
  })

  const matches = createMemo(() => {
    const needle = query().trim().toLowerCase()
    if (!needle) return []
    return (providers() ?? []).flatMap((provider) =>
      provider.models
        .filter((model) =>
          `${provider.id} ${provider.name} ${model.id} ${model.name}`.toLowerCase().includes(needle),
        )
        .map((model) => ({ provider, model })),
    )
  })

  const trigger = () => {
    const current = value()
    if (!current) return <span class="pe-muted">{ctx.t("settings.model.placeholder")}</span>
    if (current === "auto" || current === "composer") {
      return (
        <>
          <span class="pe-pill">{current}</span>
          <span class="pe-muted">{ctx.t("settings.model.builtin")}</span>
        </>
      )
    }
    const index = current.indexOf("/")
    const providerID = index > 0 ? current.slice(0, index) : current
    const modelID = index > 0 ? current.slice(index + 1) : ""
    const entry = findModelEntry(providers() ?? [], current)
    return (
      <>
        <span class="pe-pill">
          <span class="pe-dot" style={{ background: providerColor(providerID) }} />
          {entry?.provider.name ?? providerID}
        </span>
        <span class="pe-slash">/</span>
        <span class="pe-trigger-model">{entry?.model.name ?? modelID}</span>
      </>
    )
  }

  return (
    <div class="pe-settings" ref={root}>
      <header class="pe-header">
        <div>
          <h2 class="pe-title">{ctx.t("settings.title")}</h2>
          <p class="pe-subtitle">{ctx.t("settings.description")}</p>
        </div>
        <span class="pe-shortcut">
          {ctx.t("settings.shortcut")}: {ctx.t("settings.shortcut.unbound")}
        </span>
      </header>

      <div class="pe-list">
        <div class="pe-row pe-row--inline">
          <span class="pe-row-text">
            <span class="pe-row-title">{ctx.t("settings.mode")}</span>
          </span>
          <select
            class="pe-select"
            value={prefs.value.mode ?? "concise"}
            onChange={(event) => {
              const mode = event.currentTarget.value === "full" ? "full" : "concise"
              prefs.update((draft) => {
                draft.mode = mode
              })
            }}
          >
            <option value="concise">{ctx.t("settings.mode.concise")}</option>
            <option value="full">{ctx.t("settings.mode.full")}</option>
          </select>
        </div>

        <div class="pe-row pe-model">
          <span class="pe-row-text">
            <span class="pe-row-title">{ctx.t("settings.model")}</span>
            <span class="pe-row-help">{ctx.t("settings.model.help")}</span>
          </span>
          <div class="pe-picker">
            <button
              type="button"
              class="pe-trigger"
              aria-haspopup="listbox"
              aria-expanded={open() ? "true" : "false"}
              onClick={() => (open() ? setOpen(false) : openPicker())}
            >
              {trigger()}
              <span class="pe-trigger-end">
                <Show when={variants().length > 0}>
                  <span class="pe-strength-tag" title={ctx.t("settings.variant")}>
                    {prefs.value.variant ?? ctx.t("settings.variant.inherit")}
                  </span>
                </Show>
                <span class="pe-caret" aria-hidden="true">
                  ▾
                </span>
              </span>
            </button>
            <Show when={open()}>
              <div
                class="pe-popover"
                role="listbox"
                onKeyDown={(event) => {
                  if (event.key === "Escape") setOpen(false)
                }}
              >
                <div class="pe-toolbar">
                  <input
                    class="pe-search"
                    placeholder={ctx.t("settings.model.search")}
                    value={query()}
                    spellcheck={false}
                    onInput={(event) => setQuery(event.currentTarget.value)}
                  />
                  <For each={["auto", "composer", ""]}>
                    {(preset) => (
                      <button
                        type="button"
                        class="pe-preset"
                        data-active={value() === preset ? "true" : "false"}
                        onClick={() => apply(preset)}
                      >
                        {preset || ctx.t("settings.model.preset.empty")}
                      </button>
                    )}
                  </For>
                  <Show when={variants().length > 0}>
                    <select
                      class="pe-strength"
                      title={ctx.t("settings.variant")}
                      value={prefs.value.variant ?? ""}
                      onChange={(event) => {
                        const next = event.currentTarget.value
                        prefs.update((draft) => {
                          draft.variant = next || undefined
                        })
                      }}
                    >
                      <option value="">{ctx.t("settings.variant.inherit")}</option>
                      <For each={variants()}>{(variant) => <option value={variant}>{variant}</option>}</For>
                    </select>
                  </Show>
                </div>
                <Show
                  when={query().trim()}
                  fallback={
                    <div class="pe-body">
                      <div class="pe-providers">
                        <For each={providers() ?? []}>
                          {(provider) => (
                            <button
                              type="button"
                              class="pe-provider"
                              data-active={provider.id === activeProvider() ? "true" : "false"}
                              onMouseEnter={() => setActiveProvider(provider.id)}
                              onClick={() => setActiveProvider(provider.id)}
                            >
                              <span class="pe-dot" style={{ background: providerColor(provider.id) }} />
                              <span class="pe-provider-name">{provider.name}</span>
                            </button>
                          )}
                        </For>
                        <Show when={(providers() ?? []).length === 0}>
                          <div class="pe-empty">
                            {providers() === null ? "…" : ctx.t("settings.model.noProviders")}
                          </div>
                        </Show>
                      </div>
                      <div class="pe-models">
                        <For each={activeModels()}>
                          {(model) => (
                            <ModelRow
                              provider={activeEntry()!}
                              model={model}
                              active={value() === `${activeEntry()!.id}/${model.id}`}
                              onPick={apply}
                            />
                          )}
                        </For>
                        <Show when={activeModels().length === 0 && (providers() ?? []).length > 0}>
                          <div class="pe-empty">{ctx.t("settings.model.empty")}</div>
                        </Show>
                      </div>
                    </div>
                  }
                >
                  <div class="pe-body pe-body--search">
                    <div class="pe-models pe-models--wide">
                      <For each={matches()}>
                        {(entry) => (
                          <ModelRow
                            provider={entry.provider}
                            model={entry.model}
                            active={value() === `${entry.provider.id}/${entry.model.id}`}
                            onPick={apply}
                          />
                        )}
                      </For>
                      <Show when={matches().length === 0}>
                        <div class="pe-empty">{ctx.t("settings.model.empty")}</div>
                      </Show>
                      <Show when={direct()}>
                        <button type="button" class="pe-direct" onClick={() => apply(direct())}>
                          {ctx.t("settings.model.direct")} {direct()}
                        </button>
                      </Show>
                    </div>
                  </div>
                </Show>
              </div>
            </Show>
          </div>
        </div>

        <label class="pe-row pe-row--inline">
          <span class="pe-row-text">
            <span class="pe-row-title">{ctx.t("settings.animate")}</span>
            <span class="pe-row-help">{ctx.t("settings.animate.help")}</span>
          </span>
          <span class="pe-switch">
            <input
              type="checkbox"
              checked={prefs.value.animate ?? true}
              onChange={(event) => {
                const enabled = event.currentTarget.checked
                prefs.update((draft) => {
                  draft.animate = enabled
                })
              }}
            />
            <span class="pe-track" aria-hidden="true">
              <span class="pe-thumb" />
            </span>
          </span>
        </label>

        <label class="pe-row pe-row--inline">
          <span class="pe-row-text">
            <span class="pe-row-title">{ctx.t("settings.projectContext")}</span>
            <span class="pe-row-help">{ctx.t("settings.projectContext.help")}</span>
          </span>
          <span class="pe-switch">
            <input
              type="checkbox"
              checked={prefs.value.projectContext ?? true}
              onChange={(event) => {
                const enabled = event.currentTarget.checked
                prefs.update((draft) => {
                  draft.projectContext = enabled
                })
              }}
            />
            <span class="pe-track" aria-hidden="true">
              <span class="pe-thumb" />
            </span>
          </span>
        </label>

        <label class="pe-row pe-row--inline">
          <span class="pe-row-text">
            <span class="pe-row-title">
              {ctx.t("settings.outline")}
              <span class="pe-badge">{ctx.t("settings.outline.badge")}</span>
            </span>
            <span class="pe-row-help">{ctx.t("settings.outline.help")}</span>
          </span>
          <span class="pe-switch">
            <input
              type="checkbox"
              checked={prefs.value.outline ?? false}
              onChange={(event) => {
                const enabled = event.currentTarget.checked
                prefs.update((draft) => {
                  draft.outline = enabled
                })

                if (!enabled) return

                const session = ctx.sessions.current()
                ctx.toast.show({
                  title: ctx.t("settings.outline.on"),
                  description: session
                    ? ctx.t("settings.outline.openedDesc")
                    : ctx.t("settings.outline.onDesc"),
                  variant: "default",
                })

                if (session) {
                  requestOutlineOpen(ctx, session)
                }
              }}
            />
            <span class="pe-track" aria-hidden="true">
              <span class="pe-thumb" />
            </span>
          </span>
        </label>
      </div>
    </div>
  )
}

export const SETTINGS_STYLE = `
.pe-settings{--pe-fg:#0f172a;--pe-muted:#64748b;--pe-line:#f1f5f9;--pe-border:#e2e8f0;--pe-card:#ffffff;--pe-soft:#f8fafc;--pe-hover:#f1f5f9;--pe-accent:#2563eb;--pe-accent-soft:#eff6ff;display:flex;flex-direction:column;color:var(--pe-fg);font-size:13px;line-height:1.45}
@media (prefers-color-scheme:dark){.pe-settings{--pe-fg:#e2e8f0;--pe-muted:#94a3b8;--pe-line:#1e293b;--pe-border:#334155;--pe-card:#0f172a;--pe-soft:#111827;--pe-hover:#1e293b;--pe-accent:#60a5fa;--pe-accent-soft:#172554}}
.pe-header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:40px 40px 0;background:var(--v2-background-bg-base,var(--pe-card))}
.pe-title{margin:0;font-size:15px;font-weight:640;line-height:1.4}
.pe-subtitle{margin:4px 0 0;font-size:13px;font-weight:440;line-height:20px;color:var(--v2-text-text-muted,var(--pe-muted))}
.pe-shortcut{flex:none;font-size:11px;color:var(--pe-muted);border:1px solid var(--pe-border);background:var(--pe-soft);border-radius:999px;padding:4px 10px;white-space:nowrap}
.pe-list{margin:24px 40px calc(80px + var(--settings-bottom-inset,0px));padding-inline:20px;border-radius:8px;background:var(--v2-background-bg-layer-01,var(--pe-card));box-shadow:inset 0 0 0 .5px var(--v2-border-border-muted,var(--pe-border))}
.pe-row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding-block:20px;border-bottom:.5px solid var(--v2-border-border-base,var(--pe-line))}
.pe-row:last-child{border-bottom:none}
.pe-row--inline{align-items:center;cursor:pointer}
div.pe-row--inline{cursor:default}
.pe-row-text{display:flex;flex-direction:column;gap:8px;min-width:0}
.pe-row-title{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:530;line-height:1.5;letter-spacing:-.04px;color:var(--v2-text-text-base,var(--pe-fg))}
.pe-row-help{font-size:13px;font-weight:440;line-height:20px;margin-block:-3.5px;color:var(--v2-text-text-muted,var(--pe-muted))}
.pe-badge{font-size:10px;font-weight:500;padding:1px 6px;border-radius:999px;background:var(--pe-accent-soft);color:var(--pe-accent)}
.pe-select{appearance:base-select;position:relative;display:flex;align-items:center;justify-content:center;text-align:center;height:32px;min-width:170px;border:1px solid var(--pe-border);border-radius:8px;background:var(--pe-card);color:inherit;padding:0 24px;font-size:12px;cursor:pointer}
.pe-select::picker-icon,.pe-strength::picker-icon{color:var(--pe-muted);font-size:10px;transition:rotate .15s}
.pe-select::picker-icon{position:absolute;right:10px}
.pe-select:open::picker-icon,.pe-strength:open::picker-icon{rotate:180deg}
.pe-select::picker(select),.pe-strength::picker(select){appearance:base-select;margin-top:4px;border:1px solid var(--pe-border);border-radius:10px;background:var(--pe-card);padding:4px;box-shadow:0 8px 24px rgba(15,23,42,.16)}
.pe-select option,.pe-strength option{padding:6px 8px;border-radius:6px;font-size:12px;background:transparent;color:inherit;text-align:left}
.pe-select option:hover,.pe-strength option:hover{background:var(--pe-hover)}
.pe-select option:checked,.pe-strength option:checked{background:var(--pe-accent-soft);color:var(--pe-accent)}
.pe-switch{position:relative;display:inline-flex;flex:none}
.pe-switch input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.pe-track{display:inline-block;position:relative;width:36px;height:20px;border-radius:999px;background:var(--pe-border);transition:background .15s ease}
.pe-thumb{position:absolute;top:2px;left:2px;width:16px;height:16px;border-radius:50%;background:#ffffff;box-shadow:0 1px 2px rgba(15,23,42,.28);transition:transform .15s ease}
.pe-switch input:checked + .pe-track{background:var(--pe-accent)}
.pe-switch input:checked + .pe-track .pe-thumb{transform:translateX(16px)}
.pe-switch input:focus-visible + .pe-track{outline:2px solid var(--pe-accent);outline-offset:2px}
.pe-model{flex-direction:column;align-items:stretch}
.pe-model .pe-picker{position:relative;width:100%}
.pe-trigger{width:100%;height:40px;display:flex;align-items:center;gap:8px;padding:0 10px;border:1px solid var(--pe-border);border-radius:9px;background:var(--pe-card);color:inherit;font-size:12px;text-align:left;cursor:pointer}
.pe-trigger:hover{background:var(--pe-hover)}
.pe-trigger-model{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe-trigger-end{margin-left:auto;display:flex;align-items:center;gap:6px;flex-shrink:0}
.pe-strength-tag{border:1px solid var(--pe-border);border-radius:999px;padding:2px 8px;white-space:nowrap}
.pe-caret{color:var(--pe-muted);font-size:10px}
.pe-muted{color:var(--pe-muted)}
.pe-pill{display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;background:var(--pe-soft);border:1px solid var(--pe-border);font-size:11px;white-space:nowrap}
.pe-slash{color:var(--pe-muted)}
.pe-dot{width:8px;height:8px;border-radius:50%;flex:none}
.pe-popover{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:20;background:var(--pe-card);border:1px solid var(--pe-border);border-radius:12px;box-shadow:0 14px 34px rgba(15,23,42,.18);overflow:hidden;animation:pe-pop .16s ease-out}
@keyframes pe-pop{from{opacity:0;transform:translateY(-4px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.pe-popover{animation:none}}
.pe-toolbar{display:flex;flex-wrap:wrap;align-items:center;gap:6px;padding:8px;border-bottom:1px solid var(--pe-line)}
.pe-search{flex:1;min-width:0;height:30px;border:1px solid var(--pe-border);border-radius:8px;background:var(--pe-soft);color:inherit;padding:0 10px;font-size:12px}
.pe-preset{height:26px;padding:0 9px;border-radius:999px;border:1px solid var(--pe-border);background:transparent;color:var(--pe-muted);font-size:11px;cursor:pointer;white-space:nowrap}
.pe-preset:hover{background:var(--pe-hover);color:var(--pe-fg)}
.pe-preset[data-active="true"]{border-color:var(--pe-accent);color:var(--pe-accent);background:var(--pe-accent-soft)}
.pe-strength{appearance:base-select;height:26px;max-width:110px;padding:0 6px;border:1px solid var(--pe-border);border-radius:8px;background:transparent;color:inherit;font-size:11px;cursor:pointer;flex-shrink:0}
.pe-strength::picker(select){min-width:140px}
.pe-body{display:grid;grid-template-columns:36% 64%;height:240px}
.pe-body--search{grid-template-columns:1fr}
.pe-providers{border-right:1px solid var(--pe-line);overflow-y:auto;padding:6px}
.pe-provider{width:100%;display:flex;align-items:center;gap:8px;padding:7px 8px;border:0;border-radius:7px;background:transparent;color:inherit;font-size:12px;text-align:left;cursor:pointer}
.pe-provider:hover{background:var(--pe-hover)}
.pe-provider[data-active="true"]{background:var(--pe-accent-soft);color:var(--pe-accent)}
.pe-provider-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe-models{overflow-y:auto;padding:6px}
.pe-models--wide{grid-column:1 / -1}
.pe-model-item{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:2px 8px;padding:7px 8px;border:0;border-radius:7px;background:transparent;color:inherit;text-align:left;cursor:pointer}
.pe-model-item:hover{background:var(--pe-hover)}
.pe-model-item[data-selected="true"]{background:var(--pe-accent-soft)}
.pe-model-id{font-size:12px;font-weight:500;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe-model-tags{display:flex;gap:4px;justify-content:flex-end;flex-wrap:wrap}
.pe-model-desc{grid-column:1 / -1;font-size:11px;color:var(--pe-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pe-chip{font-size:10px;line-height:16px;padding:0 6px;border-radius:999px;background:var(--pe-soft);border:1px solid var(--pe-line);color:var(--pe-muted);white-space:nowrap}
.pe-chip--rec{border-color:transparent;background:var(--pe-accent-soft);color:var(--pe-accent)}
.pe-empty{padding:14px 10px;color:var(--pe-muted);font-size:12px;text-align:center}
.pe-direct{margin:6px;padding:8px 10px;border:1px dashed var(--pe-border);border-radius:8px;background:transparent;color:var(--pe-fg);font-size:12px;text-align:left;cursor:pointer}
.pe-direct:hover{background:var(--pe-hover)}
@media (max-width:600px){.pe-header{padding:48px 0 0}.pe-list{margin:24px 0 calc(80px + var(--settings-bottom-inset,0px))}.pe-row{flex-direction:column;align-items:stretch;gap:16px}.pe-row--inline{align-items:flex-start}.pe-switch{align-self:flex-end}.pe-select{width:100%}.pe-body{grid-template-columns:1fr;height:auto;max-height:340px}.pe-providers{border-right:0;border-bottom:1px solid var(--pe-line);max-height:130px}}
`

export function createSettingsPage(ctx: Ctx): SettingsPage {
  return {
    id: "prompt-optimization",
    get title() {
      return ctx.t("settings.title")
    },
    get entries() {
      return [
        {
          id: "prompt-optimization",
          title: ctx.t("settings.title"),
          description: ctx.t("settings.description"),
        },
      ]
    },
    render: () => <Settings />,
  }
}