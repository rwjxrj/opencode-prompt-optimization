import type { DraftDoc } from "./optimizer.js"

export type Mode = "concise" | "full"

export type ModelRef = {
  providerID: string
  id: string
  variant?: string
}

export type ComposerModel = {
  providerID: string
  modelID: string
  variant?: string
}

export type ModelInfoLike = {
  id: string
  modelID?: string
  providerID: string
  name?: string
  type?: string
  enabled?: boolean
  status?: string
  cost?: Array<{
    tier?: { type: "context"; size: number }
    input: number
    output: number
    cache?: { read: number; write: number }
  }>
}

export type VcsSummary = {
  branch?: string
  files?: string[]
}

export type OptimizeInput = {
  text: string
  mode: Mode
  round: number
  previous?: string
  sessionID?: string
  directory?: string
  composerModel?: ComposerModel
  modelPreference?: string
  variant?: string
  projectContext?: boolean
}

export type OptimizeResult =
  | { ok: true; text: string; model?: string }
  | { ok: false; code: string; message: string }

export type CatalogModel = {
  id: string
  name: string
  context?: number
  tags: Array<"reasoning" | "fast">
  variants: string[]
  recommended?: boolean
}

export type CatalogProvider = {
  id: string
  name: string
  models: CatalogModel[]
}

export type CatalogResult = {
  providers: CatalogProvider[]
}

export type Run = {
  original: DraftDoc
  versions: DraftDoc[]
  index: number
}

export type PluginOptions = Record<string, unknown>
