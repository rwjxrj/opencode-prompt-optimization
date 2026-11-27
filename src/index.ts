import { Plugin } from "@opencode/plugin"
import { resolveConfig } from "./config.js"
import { buildPrompt } from "./prompts.js"
import { cleanOutput, shouldSkip, validateOutput } from "./optimizer.js"
import { pickModel, modelTags } from "./model.js"
import { readProjectContext, resolveProjectDirectory } from "./project-context.js"
import { PromptOptimization } from "./rpc.js"
import type {
  CatalogModel,
  CatalogResult,
  ModelInfoLike,
  ModelRef,
  OptimizeInput,
  OptimizeResult,
  VcsSummary,
} from "./types.js"

class TimeoutError extends Error {
  constructor() {
    super("timeout")
    this.name = "TimeoutError"
  }
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new TimeoutError()), timeoutMs)
    promise.then(
      (value) => {
        clearTimeout(timer)
        resolve(value)
      },
      (error) => {
        clearTimeout(timer)
        reject(error)
      },
    )
  })
}

async function readVcs(ctx: any, directory: string): Promise<VcsSummary | undefined> {
  try {
    const input = { location: { directory } }
    const info = await ctx.vcs.get(input)
    const status = await ctx.vcs.status(input)
    return {
      branch: info?.data?.branch?.current,
      files: Array.isArray(status?.data) ? status.data.map((file: any) => file.file) : [],
    }
  } catch {
    return undefined
  }
}

function modelRefFromSession(session: any): ModelRef | undefined {
  const model = session?.model
  if (!model?.providerID || !model?.id) return undefined
  return {
    providerID: model.providerID,
    id: model.id,
    ...(model.variant ? { variant: model.variant } : {}),
  }
}

async function readModels(ctx: any): Promise<ModelInfoLike[]> {
  try {
    const listed = (await ctx.model.list()) as unknown as ModelInfoLike[] | { data?: ModelInfoLike[] }
    return Array.isArray(listed) ? listed : Array.isArray(listed?.data) ? listed.data : []
  } catch {
    return []
  }
}

async function readDefaultModel(ctx: any): Promise<ModelInfoLike | null> {
  try {
    const selected = (await ctx.model.default()) as unknown as
      | ModelInfoLike
      | { data?: ModelInfoLike | null }
      | null
    return selected && "data" in selected ? (selected.data ?? null) : (selected as ModelInfoLike | null)
  } catch {
    return null
  }
}

type CatalogSourceModel = ModelInfoLike & {
  limit?: { context?: number }
  variants?: ReadonlyArray<string | { id?: string }>
}
type CatalogSourceProvider = { id: string; name?: string; activation?: string }

async function readProviders(ctx: any): Promise<CatalogSourceProvider[]> {
  try {
    const listed = (await ctx.provider.list({})) as unknown as
      | CatalogSourceProvider[]
      | { data?: CatalogSourceProvider[] }
    const data = Array.isArray(listed) ? listed : Array.isArray(listed?.data) ? listed.data : []
    return data.filter((provider) => typeof provider?.id === "string")
  } catch {
    return []
  }
}

async function readCatalog(ctx: any): Promise<CatalogResult> {
  const [providers, models, defaultModel] = await Promise.all([
    readProviders(ctx),
    readModels(ctx),
    readDefaultModel(ctx),
  ])
  const names = new Map(providers.map((provider) => [provider.id, provider.name]))
  const disabled = new Set(
    providers.filter((provider) => provider.activation === "disabled").map((provider) => provider.id),
  )
  const recommended = defaultModel ? `${defaultModel.providerID}/${defaultModel.id}` : ""
  const grouped = new Map<string, CatalogModel[]>()

  for (const model of models as CatalogSourceModel[]) {
    if (!model?.id || !model.providerID) continue
    if (disabled.has(model.providerID)) continue
    if (model.enabled === false || model.status === "deprecated") continue
    if (model.type && model.type !== "chat") continue

    const entry: CatalogModel = {
      id: model.id,
      name: model.name || model.id,
      tags: modelTags(model.id, model.name),
      variants: (model.variants ?? [])
        .map((variant) => (typeof variant === "string" ? variant : (variant?.id ?? "")))
        .filter(Boolean),
      ...(model.limit?.context ? { context: model.limit.context } : {}),
      ...(recommended === `${model.providerID}/${model.id}` ? { recommended: true } : {}),
    }
    const bucket = grouped.get(model.providerID)
    if (bucket) bucket.push(entry)
    else grouped.set(model.providerID, [entry])
  }

  return {
    providers: [...grouped.entries()]
      .map(([id, models]) => ({
        id,
        name: names.get(id) ?? id,
        models: models.sort((left, right) => left.name.localeCompare(right.name)),
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  }
}

export default Plugin.define({
  id: "prompt-optimization",
  async setup(ctx) {
    const registration = await ctx.rpc.register(PromptOptimization, {
      optimize: async (raw, rpcContext): Promise<OptimizeResult> => {
        const input = raw as OptimizeInput
        const config = resolveConfig(ctx.options, {
          mode: input.mode,
          model: input.modelPreference,
          projectContext: input.projectContext,
        })

        const decision = shouldSkip(input.text, config)
        if (decision.skip) {
          return {
            ok: false,
            code: decision.reason ?? "skipped",
            message: decision.reason ?? "skipped",
          }
        }

        let session: any
        try {
          if (input.sessionID) session = await ctx.session.get({ sessionID: input.sessionID })
        } catch {
          session = undefined
        }

        let models: ModelInfoLike[] = []
        let defaultModel: ModelInfoLike | null = null
        try {
          ;[models, defaultModel] = await Promise.all([readModels(ctx), readDefaultModel(ctx)])
        } catch {
          models = []
          defaultModel = null
        }

        const sessionModel = modelRefFromSession(session)
        const picked = pickModel({
          preference: config.model,
          composerModel: input.composerModel,
          sessionModel,
          models,
          defaultModel,
        })

        if (!picked) {
          return {
            ok: false,
            code: "no_model",
            message: "No connected chat model is available.",
          }
        }

        let projectContext = ""
        if (config.projectContext) {
          const directory = resolveProjectDirectory({
            sessionDirectory: session?.location?.directory,
            requestDirectory: input.directory,
            pluginDirectory: ctx.location?.directory,
          })

          if (directory) {
            const vcs = await readVcs(ctx, directory)
            try {
              projectContext = await readProjectContext(
                directory,
                config.projectContextBudget,
                vcs,
              )
            } catch {
              projectContext = ""
            }
          }
        }

        const targetModelID = input.composerModel?.modelID ?? sessionModel?.id
        const model = input.variant ? { ...picked.model, variant: input.variant } : picked.model
        const prompt = buildPrompt({
          text: input.text,
          mode: config.mode,
          structured: decision.structured,
          previous: input.previous,
          round: input.round,
          projectContext,
          targetModelID,
          prompts: config.prompts,
        })

        try {
          const generated = await withTimeout(
            ctx.experimental.generate.text({
              model,
              prompt,
            }),
            config.timeoutMs,
          )

          const cleaned = cleanOutput(generated.text)
          const validation = validateOutput(cleaned, input.text, config)
          if (!validation.ok) {
            return {
              ok: false,
              code: `invalid_${validation.reason}`,
              message: "The generated prompt did not pass validation.",
            }
          }

          return {
            ok: true,
            text: cleaned,
            model: `${model.providerID}/${model.id}`,
          }
        } catch (error) {
          if (rpcContext?.signal?.aborted) {
            return { ok: false, code: "aborted", message: "Request aborted." }
          }
          if (error instanceof TimeoutError) {
            return { ok: false, code: "timeout", message: "Expansion timed out." }
          }
          const message = error instanceof Error ? error.message : String(error)
          console.error("[prompt-optimization] generate failed:", message)
          return { ok: false, code: "failed", message: `Expansion failed: ${message}` }
        }
      },
      catalog: async (): Promise<CatalogResult> => readCatalog(ctx),
    })

    return () => registration.dispose()
  },
})
