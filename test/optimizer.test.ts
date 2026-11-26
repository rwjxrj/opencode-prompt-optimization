import { describe, expect, it } from "vitest"
import { resolveConfig } from "../src/config.js"
import {
  cleanOutput,
  countStructureMarkers,
  maskReferences,
  restoreReferences,
  shouldSkip,
  validateOutput,
} from "../src/optimizer.js"

const config = resolveConfig({})

describe("shouldSkip", () => {
  it("skips empty input silently", () => {
    const result = shouldSkip("   ", config)
    expect(result.skip).toBe(true)
    expect(result.notify).toBe(false)
  })

  it("skips short input with a notice", () => {
    const result = shouldSkip("跑一下测试", config)
    expect(result.skip).toBe(true)
    expect(result.reason).toBe("too_short")
    expect(result.notify).toBe(true)
  })

  it("skips shell commands silently", () => {
    expect(shouldSkip("!ls", config).reason).toBe("pattern")
    expect(shouldSkip("!ls", config).notify).toBe(false)
  })

  it("skips confirmation words", () => {
    expect(shouldSkip("继续", config).reason).toBe("confirmation")
  })

  it("optimizes prompts that carry @ or / references", () => {
    expect(shouldSkip("请检查 @src/app.ts 的登录实现是否正确", config).skip).toBe(false)
    expect(shouldSkip("/comet-build 把登录页的校验逻辑补完整", config).skip).toBe(false)
  })

  it("stops a reference at punctuation instead of swallowing the sentence", () => {
    const masked = maskReferences("请检查 @src/app.ts，再修复登录")
    expect(masked.refs).toEqual(["@src/app.ts"])
    expect(masked.text).toBe("请检查 [[ref1]]，再修复登录")
    expect(shouldSkip("请检查 @src/app.ts，再修复登录", config).skip).toBe(false)
  })

  it("stops a leading command at punctuation too", () => {
    const masked = maskReferences("/comet-build，把登录页的校验逻辑补完整")
    expect(masked.refs).toEqual(["/comet-build"])
    expect(masked.text).toBe("[[ref1]]，把登录页的校验逻辑补完整")
  })

  it("counts references toward the draft length", () => {
    expect(shouldSkip("优化 @src/app.ts 的代码", config).skip).toBe(false)
  })

  it("skips silently when only references are left", () => {
    const result = shouldSkip("@src/app.ts", config)
    expect(result.skip).toBe(true)
    expect(result.reason).toBe("command")
    expect(result.notify).toBe(false)
  })

  it("masks references and restores them verbatim", () => {
    const original = "/comet-build 请按 @src/app.ts 补登录，参考 docs/README.zh-CN.md"
    const masked = maskReferences(original)
    expect(masked.text).toBe("[[ref1]] 请按 [[ref2]] 补登录，参考 docs/README.zh-CN.md")
    expect(masked.refs).toEqual(["/comet-build", "@src/app.ts"])
    expect(restoreReferences("[[ref1]] 请按 [[ref2]] 补逻辑", masked.refs)).toBe(
      "/comet-build 请按 @src/app.ts 补逻辑",
    )
    expect(restoreReferences(masked.text, masked.refs)).toBe(original)
  })

  it("leaves email addresses alone", () => {
    expect(maskReferences("发到 a@b.com 就行").refs).toEqual([])
  })

  it("rejects output that drops or invents a reference", () => {
    const masked = maskReferences("看下 @src/a.ts")
    expect(masked.text).toBe("看下 [[ref1]]")
    expect(restoreReferences("看下代码", masked.refs)).toBeUndefined()
    expect(restoreReferences("看下 [[ref1]] 和 [[ref2]]", masked.refs)).toBeUndefined()
    expect(restoreReferences("看下 [[ref1]] 的代码", masked.refs)).toBe("看下 @src/a.ts 的代码")
  })

  it("allows a normal prompt through", () => {
    const result = shouldSkip("把用户模块的登录态改成 JWT", config)
    expect(result.skip).toBe(false)
  })

  it("allows an empty user skip pattern list", () => {
    const custom = resolveConfig({ skipPatterns: [] })
    expect(custom.skipPatterns).toHaveLength(0)
  })
})

describe("structure markers", () => {
  it("counts target/scope/requirements/acceptance", () => {
    expect(countStructureMarkers("目标：A 范围：B 要求：C 验收：D")).toBe(4)
  })
})

describe("cleanOutput", () => {
  it("strips code fences", () => {
    expect(cleanOutput("```md\n目标：做一个看板\n```")).toBe("目标：做一个看板")
  })

  it("strips leading labels and quotes", () => {
    expect(cleanOutput("优化后的提示词：\n“目标：做一个看板”")).toBe("目标：做一个看板")
  })
})

describe("validateOutput", () => {
  it("rejects empty output", () => {
    expect(validateOutput("   ", "原文", config).ok).toBe(false)
  })

  it("rejects unchanged output", () => {
    expect(validateOutput("原文", "原文", config).ok).toBe(false)
  })

  it("rejects extreme growth", () => {
    const original = "做一个看板"
    const output = "内容".repeat(1200)
    expect(validateOutput(output, original, config).ok).toBe(false)
  })

  it("accepts a reasonable expansion", () => {
    expect(validateOutput("目标：做一个数据看板，包含筛选和导出。", "帮我做个数据看板", config).ok).toBe(
      true,
    )
  })
})
