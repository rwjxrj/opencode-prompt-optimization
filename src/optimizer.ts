import type { Config } from "./config.js"

export type SkipReason =
  | "empty"
  | "command"
  | "too_short"
  | "too_long"
  | "confirmation"
  | "pattern"

export type SkipDecision = {
  skip: boolean
  reason?: SkipReason
  notify: boolean
  structured: boolean
}

const STRUCTURE_MARKERS = [/目标/, /范围/, /要求/, /验收/]

const CONFIRMATION = /^(继续|好的|收到|谢谢|可以|ok|okay|yes|no|go|continue|thanks?)[。.!！]?$/i
// A leading slash reference is a command; `@` references are file/skill chips.
// Both end at whitespace or punctuation, so the sentence after a reference is still prose.
const REF = String.raw`[^\s，。；：！？、（）【】「」《》“”‘’,;!?]+`
const COMMAND = new RegExp(`^(\\s*)(/${REF})`)
const MENTION = new RegExp(`(^|\\s)(@${REF})`, "g")
const PLACEHOLDER = /\[\[ref\d+\]\]/g

export type References = {
  text: string
  refs: string[]
}

/** Replaces `@refs` and a leading `/command` with `[[refN]]` so the model cannot rewrite them. */
export function maskReferences(text: string): References {
  const refs: string[] = []
  const mask = (_match: string, lead: string, ref: string): string => {
    refs.push(ref)
    return `${lead}[[ref${refs.length}]]`
  }
  return { text: text.replace(COMMAND, mask).replace(MENTION, mask), refs }
}

/** Puts the references back; undefined when the model dropped, duplicated or invented a placeholder. */
export function restoreReferences(text: string, refs: string[]): string | undefined {
  let restored = text
  for (let index = 0; index < refs.length; index += 1) {
    const placeholder = `[[ref${index + 1}]]`
    if (!restored.includes(placeholder)) return undefined
    restored = restored.replace(placeholder, refs[index]!)
  }
  return restored.match(PLACEHOLDER) ? undefined : restored
}

export function countStructureMarkers(text: string): number {
  return STRUCTURE_MARKERS.filter((pattern) => pattern.test(text)).length
}

export function hasStructure(text: string): boolean {
  return countStructureMarkers(text) >= 3
}

export function shouldSkip(text: string, config: Config): SkipDecision {
  const trimmed = text.trim()
  const structured = hasStructure(trimmed)

  if (!trimmed) return { skip: true, reason: "empty", notify: false, structured }

  // Length limits count the whole draft, references included: a short instruction
  // with a @file is still a real request, while a bare reference is not.
  const masked = maskReferences(trimmed)
  const prose = masked.text.replace(PLACEHOLDER, "").trim()
  if (!prose) return { skip: true, reason: "command", notify: false, structured }
  if (CONFIRMATION.test(prose)) {
    return { skip: true, reason: "confirmation", notify: false, structured }
  }
  if (config.skipPatterns.some((pattern) => pattern.test(prose))) {
    return { skip: true, reason: "pattern", notify: false, structured }
  }
  if (countChars(trimmed) < config.minChars) {
    return { skip: true, reason: "too_short", notify: true, structured }
  }
  if (countChars(trimmed) > config.maxPromptChars) {
    return { skip: true, reason: "too_long", notify: false, structured }
  }

  return { skip: false, notify: false, structured }
}

export function countChars(text: string): number {
  return Array.from(text).length
}

function stripCodeFences(text: string): string {
  if (!text.includes("```")) return text
  return text
    .replace(/^\s*```[^\n]*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .replace(/^\s*```[^\n]*$/gm, "")
    .trim()
}

function stripLeadingLabel(text: string): string {
  return text.replace(
    /^(优化后的提示词|增强后的提示词|改写后的提示词|增强结果|优化结果|expanded prompt|optimized prompt)\s*[:：]\s*/i,
    "",
  )
}

function stripWrappingQuotes(text: string): string {
  const pairs: Array<[string, string]> = [
    ['"', '"'],
    ["'", "'"],
    ["“", "”"],
    ["‘", "’"],
    ["「", "」"],
    ["『", "』"],
  ]
  for (const [open, close] of pairs) {
    if (text.startsWith(open) && text.endsWith(close) && text.length >= open.length + close.length) {
      return text.slice(open.length, -close.length).trim()
    }
  }
  return text
}

export function cleanOutput(text: string): string {
  let result = text.trim()
  result = stripCodeFences(result)
  result = stripLeadingLabel(result)
  result = stripWrappingQuotes(result)
  return result.trim()
}

export type Validation = { ok: true } | { ok: false; reason: "empty" | "unchanged" | "too_large" }

export function validateOutput(output: string, original: string, config: Config): Validation {
  const cleaned = output.trim()
  if (!cleaned) return { ok: false, reason: "empty" }
  if (cleaned === original.trim()) return { ok: false, reason: "unchanged" }
  if (countChars(cleaned) > countChars(original) * config.maxGrowth && countChars(cleaned) > 2000) {
    return { ok: false, reason: "too_large" }
  }
  return { ok: true }
}
