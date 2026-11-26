import { describe, expect, it } from "vitest"
import { createController } from "../src/gui/controller.js"

const TEXT = "帮我做一个数据看板，包含筛选和导出"
type Request = { round: number; text: string; variant?: string }
type Args = Parameters<typeof createController>

function setup(reply: (input: Request) => unknown, initial: string = TEXT) {
  let composerText = initial
  const rpcInputs: Request[] = []
  const prefs = { mode: "concise", model: "auto", projectContext: false }
  const composer = {
    text: () => composerText,
    setText: (value: string) => {
      composerText = value
    },
    focus: () => {},
    model: () => ({ providerID: "opencode-go", modelID: "deepseek-v4.1-flash" }),
  }
  const ctx = {
    options: { model: "opencode-go/deepseek-v4.1-flash" },
    t: (key: string) => key,
    toast: { show: () => ({ dismiss: () => {} }) },
    sessions: { current: () => ({ id: "ses_test", directory: "D:/project" }) },
    screen: { current: () => ({ composer }) },
    stores: {
      prefs: {
        value: prefs,
        update: (mutate: (draft: typeof prefs) => void) => mutate(prefs),
      },
    },
    client: {
      rpc: () => ({
        optimize: async (input: Request) => {
          rpcInputs.push(input)
          return reply(input)
        },
      }),
    },
  }
  const draft = { available: () => false, composer }
  const controller = createController(ctx as unknown as Args[0], draft as unknown as Args[1])
  return { controller, composer, rpcInputs, text: () => composerText }
}

describe("controller.expand outcome", () => {
  it("returns done and writes the expanded text", async () => {
    const run = setup(() => ({ ok: true, text: "EXPANDED" }))

    await expect(run.controller.expand()).resolves.toBe("done")
    expect(run.text()).toBe("EXPANDED")
    expect(run.rpcInputs).toHaveLength(1)
  })

  it("returns skipped without calling the model for empty input", async () => {
    const run = setup(() => ({ ok: true, text: "EXPANDED" }))
    run.composer.setText("   ")

    await expect(run.controller.expand()).resolves.toBe("skipped")
    expect(run.rpcInputs).toHaveLength(0)
  })

  it("returns failed and keeps the text when the model fails", async () => {
    const run = setup(() => ({ ok: false, code: "no_model", message: "none" }))

    await expect(run.controller.expand()).resolves.toBe("failed")
    expect(run.text()).toBe(TEXT)
  })

  it("sends placeholders to the model and restores references verbatim", async () => {
    const original = "请检查 @src/app.ts 的登录实现是否正确"
    const run = setup(
      () => ({ ok: true, text: "请检查 [[ref1]] 的登录实现是否正确，并补充失败分支" }),
      original,
    )

    await expect(run.controller.expand()).resolves.toBe("done")
    expect(run.rpcInputs[0]!.text).toBe("请检查 [[ref1]] 的登录实现是否正确")
    expect(run.text()).toBe("请检查 @src/app.ts 的登录实现是否正确，并补充失败分支")
  })

  it("keeps the draft when the model drops a reference", async () => {
    const original = "请检查 @src/app.ts 的登录实现是否正确"
    const run = setup(() => ({ ok: true, text: "请检查登录实现是否正确" }), original)

    await expect(run.controller.expand()).resolves.toBe("failed")
    expect(run.text()).toBe(original)
  })

  it("expands short prose that carries a reference", async () => {
    const run = setup(
      () => ({ ok: true, text: "优化 [[ref1]] 的代码结构" }),
      "优化 @src/app.ts 的代码",
    )

    await expect(run.controller.expand()).resolves.toBe("done")
    expect(run.rpcInputs).toHaveLength(1)
  })
})