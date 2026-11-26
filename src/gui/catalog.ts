import type { CatalogModel, CatalogProvider } from "../types.js"

export function contextLabel(size: number | undefined): string {
  if (!size || size <= 0) return ""
  if (size >= 1_000_000) {
    const millions = size / 1_000_000
    return `${millions >= 10 ? Math.round(millions) : Math.round(millions * 10) / 10}M`
  }
  return `${Math.round(size / 1000)}K`
}

const BRAND: Record<string, string> = {
  anthropic: "#d97706",
  openai: "#10b981",
  google: "#3b82f6",
  gemini: "#3b82f6",
  deepseek: "#6366f1",
  mistral: "#f97316",
  meta: "#2563eb",
  groq: "#ef4444",
  openrouter: "#8b5cf6",
  opencode: "#22c55e",
  xai: "#111827",
  cohere: "#14b8a6",
  ollama: "#64748b",
}

const PALETTE = ["#6366f1", "#8b5cf6", "#ec4899", "#f97316", "#10b981", "#3b82f6", "#14b8a6", "#eab308"]

export function providerColor(id: string): string {
  const known = BRAND[id.toLowerCase()]
  if (known) return known
  let hash = 0
  for (let index = 0; index < id.length; index += 1) hash = (hash * 31 + id.charCodeAt(index)) >>> 0
  return PALETTE[hash % PALETTE.length]!
}

export function findModelEntry(
  providers: CatalogProvider[],
  value: string,
): { provider: CatalogProvider; model: CatalogModel } | undefined {
  const index = value.indexOf("/")
  if (index <= 0 || index === value.length - 1) return undefined
  const provider = providers.find((entry) => entry.id === value.slice(0, index))
  const model = provider?.models.find((entry) => entry.id === value.slice(index + 1))
  return provider && model ? { provider, model } : undefined
}

export function variantsFor(providers: CatalogProvider[], value: string): string[] {
  return findModelEntry(providers, value)?.model.variants ?? []
}