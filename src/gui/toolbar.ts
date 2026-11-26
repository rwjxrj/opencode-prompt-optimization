import { Style, type SetupContext } from "@opencode/plugin/gui"
import type { Controller } from "./controller.js"
import type { definition } from "./definition.js"

type Ctx = SetupContext<typeof definition>

const MARK = "data-prompt-expand"
const FORM = 'form[data-component="composer"]'
type PeState = "idle" | "loading" | "success"
const STYLE = [
  `@property --pe-angle{syntax:"<angle>";initial-value:0deg;inherits:false}`,
  `[${MARK}]{display:inline-flex;align-items:center;justify-content:center;flex:none;padding:0;border:0;background:transparent;color:inherit;cursor:pointer;opacity:.7;transition:opacity .15s,background .2s,box-shadow .2s}`,
  `[${MARK}]:hover{opacity:1}`,
  `[${MARK}]:disabled{cursor:default;opacity:.4}`,
  `[${MARK}] .pe-ring{opacity:0;transition:opacity .2s}`,
  `[${MARK}] .pe-check{opacity:0}`,
  `[${MARK}] .pe-stars,[${MARK}] .pe-s1,[${MARK}] .pe-s2,[${MARK}] .pe-check{transform-box:fill-box;transform-origin:center}`,
  `[${MARK}] .pe-stars{transition:opacity .18s}`,
  `[${MARK}][data-state="loading"]{opacity:1;cursor:default;background:linear-gradient(135deg,rgba(99,102,241,.10),rgba(168,85,247,.12));box-shadow:0 0 0 1px rgba(139,92,246,.25),0 4px 14px rgba(139,92,246,.18)}`,
  `[${MARK}][data-state="loading"] .pe-ring{opacity:1}`,
  `[${MARK}][data-state="loading"] .pe-main{stroke:var(--pe-grad)}`,
  `[${MARK}][data-state="loading"][data-animate="on"] .pe-stars{animation:pe-breathe 1.6s ease-in-out infinite}`,
  `[${MARK}][data-state="loading"][data-animate="on"] .pe-s1{animation:pe-twinkle 1.4s ease-in-out infinite}`,
  `[${MARK}][data-state="loading"][data-animate="on"] .pe-s2{animation:pe-twinkle 2.1s ease-in-out .5s infinite}`,
  `[${MARK}][data-state="success"]{opacity:1;background:linear-gradient(135deg,rgba(16,185,129,.12),rgba(5,150,105,.10));box-shadow:0 0 0 1px rgba(16,185,129,.35)}`,
  `[${MARK}][data-state="success"] .pe-stars,[${MARK}][data-state="success"] .pe-ring{opacity:0}`,
  `[${MARK}][data-state="success"] .pe-check{opacity:1;stroke:#059669;animation:pe-pop .5s cubic-bezier(.34,1.56,.64,1)}`,
  `@keyframes pe-breathe{0%,100%{transform:scale(.94)}50%{transform:scale(1.08)}}`,
  `@keyframes pe-twinkle{0%,100%{opacity:.45;transform:scale(.85)}50%{opacity:1;transform:scale(1.15)}}`,
  `@keyframes pe-pop{0%{transform:scale(.6)}100%{transform:scale(1)}}`,
  `${FORM}[data-pe-state="loading"][data-pe-animate="on"]{box-shadow:0 0 0 1px rgba(99,102,241,.35),0 0 18px 2px rgba(168,85,247,.25),0 0 38px 8px rgba(236,72,153,.16)}`,
  `${FORM}[data-pe-state="loading"][data-pe-animate="on"]::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1.6px;pointer-events:none;z-index:1;background:conic-gradient(from var(--pe-angle),#6366f1,#a855f7,#ec4899,rgba(236,72,153,0) 38%,rgba(99,102,241,0) 62%,#6366f1);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:pe-spin 2.4s linear infinite}`,
  `@keyframes pe-spin{to{--pe-angle:360deg}}`,
  `${FORM}[data-pe-state="success"]{box-shadow:0 0 0 1.5px rgba(16,185,129,.55),inset 0 0 26px rgba(16,185,129,.16);animation:pe-flash .9s ease-out}`,
  `@keyframes pe-flash{0%{box-shadow:0 0 0 1.5px #10b981,inset 0 0 34px rgba(16,185,129,.28)}100%{box-shadow:0 0 0 1.5px rgba(16,185,129,.4),inset 0 0 0 rgba(16,185,129,0)}}`,
].join("")

let sequence = 0

/**
 * The busy animation uses SMIL elements with `begin="indefinite"`, so the first
 * frame is the idle icon and `beginElement()` starts it only while expanding.
 * Gradient ids are window-wide, so each mount gets its own suffix.
 */
function icon(id: string): string {
  return (
    `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="--pe-grad:url(#${id})">` +
    `<defs><linearGradient id="${id}" x1="0%" y1="0%" x2="100%" y2="100%">` +
    `<stop offset="0%" stop-color="#6366f1"/><stop offset="50%" stop-color="#a855f7"/><stop offset="100%" stop-color="#ec4899"/>` +
    `</linearGradient></defs>` +
    `<circle class="pe-ring" cx="12" cy="12" r="11" stroke="url(#${id})" stroke-width="1.2" stroke-dasharray="18 52">` +
    `<animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="2.2s" repeatCount="indefinite" begin="indefinite"/>` +
    `</circle>` +
    // The stars scale through CSS on `.pe-stars`, so only the inner group rotates here.
    `<g class="pe-stars">` +
    `<g>` +
    `<animateTransform attributeName="transform" type="rotate" values="0 12 12;8 12 12;0 12 12" dur="1.6s" repeatCount="indefinite" begin="indefinite"/>` +
    `<path class="pe-main" d="M12 4.5C12.7 9 15 11.3 19.5 12C15 12.7 12.7 15 12 19.5C11.3 15 9 12.7 4.5 12C9 11.3 11.3 9 12 4.5Z">` +
    `<animate attributeName="stroke-width" values="1.7;2.2;1.7" dur="1.6s" repeatCount="indefinite" begin="indefinite"/>` +
    `</path>` +
    `</g>` +
    `<path class="pe-s1" d="M5.5 3.2V7.8M3.2 5.5H7.8" stroke-width="1.7"/>` +
    `<path class="pe-s2" d="M18.5 16.2V20.8M16.2 18.5H20.8" stroke-width="1.7"/>` +
    `</g>` +
    `<path class="pe-check" d="M6.5 12.6l3.6 3.6L18 8.4" stroke-width="2.2"/>` +
    `</svg>`
  )
}

function visible(element: HTMLElement): boolean {
  const rect = element.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return false
  const style = getComputedStyle(element)
  return style.visibility !== "hidden" && style.display !== "none"
}

/**
 * The host has no slot at the composer toolbar, so the send button is found by
 * the markup it publishes: `[data-action=composer-submit]` inside
 * `[data-slot=composer-actions]`. Several composers stay mounted, so the
 * bottom-most visible one wins.
 */
function findSend(): { host: HTMLElement; anchor: Element; send: HTMLElement } | undefined {
  const submits = Array.from(document.querySelectorAll<HTMLElement>('[data-action="composer-submit"]')).filter(visible)
  const send = submits.sort((a, b) => b.getBoundingClientRect().bottom - a.getBoundingClientRect().bottom)[0]
  if (!send) return undefined
  const actions = send.closest<HTMLElement>('[data-slot="composer-actions"]')
  let anchor: Element = send
  if (actions) while (anchor.parentElement && anchor.parentElement !== actions) anchor = anchor.parentElement
  const host = anchor.parentElement
  if (!host) return undefined
  return { host, anchor, send }
}

/**
 * Mounts the expand icon button left of the composer's send button. This is a
 * best-effort DOM injection: the host owns the composer markup and re-renders
 * it, so a MutationObserver re-places the button.
 */
export function mountToolbarButton(ctx: Ctx, controller: Controller): () => void {
  ctx.add(Style, STYLE)

  if (typeof document === "undefined") return () => {}

  document.querySelectorAll(`[${MARK}]`).forEach((element) => element.remove())

  const button = document.createElement("button")
  button.type = "button"
  button.setAttribute(MARK, "")
  button.setAttribute("aria-label", ctx.t("toolbar.expand"))
  button.title = ctx.t("toolbar.expand")
  button.innerHTML = icon(`prompt-expand-grad-${++sequence}`)
  const animations = () => Array.from(button.querySelectorAll<SVGAnimationElement>("animate, animateTransform"))
  const composer = () => button.closest<HTMLElement>(FORM)
  const apply = (state: PeState) => {
    button.dataset.state = state
    button.disabled = state === "loading"
    button.toggleAttribute("aria-busy", state === "loading")
    button.dataset.animate = (ctx.stores.prefs.value.animate ?? true) ? "on" : "off"
    const form = composer()
    // shortcut: the composer border glow needs the host's form; without it the button still animates alone.
    if (!form) return
    form.dataset.peAnimate = button.dataset.animate
    if (state === "idle") form.removeAttribute("data-pe-state")
    else form.dataset.peState = state
  }
  apply("idle")

  let pending = false
  let revert = 0
  button.addEventListener("click", async () => {
    if (pending) return
    pending = true
    window.clearTimeout(revert)
    revert = 0
    apply("loading")
    if (button.dataset.animate === "on") {
      for (const element of animations()) element.beginElement()
    }
    try {
      const outcome = await controller.expand()
      // Stop the busy loops on the last frame so the success check can pop.
      for (const element of animations()) element.endElement()
      if (outcome !== "done") {
        apply("idle")
        return
      }
      apply("success")
      revert = window.setTimeout(() => {
        revert = 0
        if (button.dataset.state === "success") apply("idle")
      }, 1500)
    } catch {
      // A thrown expand would otherwise leave the button spinning forever.
      for (const element of animations()) element.endElement()
      apply("idle")
    } finally {
      pending = false
    }
  })

  let anchor: Element | null = null

  const placed = () => button.isConnected && anchor !== null && button.nextElementSibling === anchor

  let frame = 0
  const place = () => {
    frame = 0
    if (placed()) return
    const found = findSend()
    if (!found) {
      button.remove()
      return
    }
    const { host, anchor: target, send } = found
    const size = send.getBoundingClientRect().height
    if (size > 0) {
      button.style.width = `${size}px`
      button.style.height = `${size}px`
    }
    button.style.borderRadius = getComputedStyle(send).borderRadius
    button.style.marginInlineEnd = "4px"
    anchor = target
    host.insertBefore(button, target)
    // A host re-render can replace the form; restore the border state on the new one.
    if (button.dataset.state !== "idle") apply(button.dataset.state as PeState)
  }
  const schedule = () => {
    if (!frame) frame = requestAnimationFrame(place)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })
  place()

  return () => {
    observer.disconnect()
    if (frame) cancelAnimationFrame(frame)
    window.clearTimeout(revert)
    composer()?.removeAttribute("data-pe-state")
    button.remove()
  }
}