import type { DraftDoc } from "../optimizer.js"
import { bottomMostEditor } from "./draft.js"

const EDITOR = '[data-component="composer-editor"]'
const MENTION = "[data-mention]"

type EditorDoc = {
  editor: HTMLElement
  els: Array<HTMLElement | undefined>
}

// The host keeps the real part of a mention in a private WeakMap keyed by the
// span element, so a cached span must be reused instead of recreated: a cloned
// session mention would be parsed as a file.
const editorDocs = new WeakMap<DraftDoc, EditorDoc>()

function findComposerEditor(): HTMLElement | null {
  return bottomMostEditor(EDITOR)
}

/** Reads the editor into a document; undefined when it holds no mention, where plain setText is enough. */
export function readEditorDoc(): DraftDoc | undefined {
  const editor = findComposerEditor()
  if (!editor) return undefined

  const segments: DraftDoc["segments"] = []
  const refs: string[] = []
  const els: Array<HTMLElement | undefined> = []
  let text = ""

  const flush = () => {
    if (!text) return
    segments.push({ text })
    text = ""
  }

  const walk = (parent: Node) => {
    for (const node of Array.from(parent.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE) {
        text += node.textContent ?? ""
        continue
      }
      if (!(node instanceof HTMLElement)) continue

      if (node.matches(MENTION)) {
        const raw = node.textContent ?? ""
        if (!raw) continue
        flush()
        refs.push(raw)
        els.push(node)
        segments.push({ ref: refs.length - 1 })
        continue
      }

      if (node.tagName === "BR") {
        text += "\n"
        continue
      }

      const block = node.tagName === "DIV" || node.tagName === "P"
      if (block && text && !text.endsWith("\n")) text += "\n"
      walk(node)
      if (block && !text.endsWith("\n")) text += "\n"
    }
  }

  walk(editor)
  flush()
  if (refs.length === 0) return undefined

  const doc: DraftDoc = { segments: segments.length > 0 ? segments : [{ text: "" }], refs }
  editorDocs.set(doc, { editor, els })
  return doc
}

/** Lets a rewritten document reuse the spans it was derived from, so undo and version switches keep them. */
export function adoptElements(source: DraftDoc, target: DraftDoc): void {
  const cached = editorDocs.get(source)
  if (cached) editorDocs.set(target, cached)
}

/** Writes a document back into the editor whose spans it owns; false when none is available. */
export function writeDocument(doc: DraftDoc): boolean {
  const cached = editorDocs.get(doc)
  if (!cached || !cached.editor.isConnected) return false

  const written = new Set<number>()
  const nodes = doc.segments.map((segment) => {
    if ("text" in segment) return document.createTextNode(segment.text)
    const el = cached.els[segment.ref]
    if (!el) return document.createTextNode(doc.refs[segment.ref] ?? "")
    if (written.has(segment.ref)) {
      // A node can sit in one place only, so a repeated reference gets a copy.
      // shortcut: a repeated session mention parses back as a file; upgrade when the host exposes part APIs.
      return el.cloneNode(true) as HTMLElement
    }
    written.add(segment.ref)
    return el
  })
  cached.editor.replaceChildren(...nodes)

  const selection = window.getSelection()
  if (selection) {
    const range = document.createRange()
    range.selectNodeContents(cached.editor)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
  }

  // The host parses the editor on input and rebuilds the prompt parts from it.
  cached.editor.dispatchEvent(new InputEvent("input", { bubbles: true, inputType: "insertText" }))
  return true
}