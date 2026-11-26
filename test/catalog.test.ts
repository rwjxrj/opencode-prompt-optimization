import { describe, expect, it } from "vitest"
import { contextLabel, findModelEntry, providerColor, variantsFor } from "../src/gui/catalog.js"

describe("contextLabel", () => {
  it("formats token limits", () => {
    expect(contextLabel(200000)).toBe("200K")
    expect(contextLabel(1048576)).toBe("1M")
    expect(contextLabel(0)).toBe("")
    expect(contextLabel(undefined)).toBe("")
  })
})

describe("providerColor", () => {
  it("keeps a known brand color and a stable fallback", () => {
    expect(providerColor("openai")).toBe("#10b981")
    expect(providerColor("acme")).toBe(providerColor("acme"))
    expect(providerColor("acme")).toMatch(/^#[0-9a-f]{6}$/)
  })
})

describe("findModelEntry", () => {
  const providers = [
    { id: "acme", name: "Acme", models: [{ id: "fast-1", name: "Fast 1", tags: [] as const }] },
  ]

  it("splits provider/model at the first slash", () => {
    expect(findModelEntry(providers as never, "acme/fast-1")?.model.name).toBe("Fast 1")
    expect(findModelEntry(providers as never, "other/fast-1")).toBeUndefined()
    expect(findModelEntry(providers as never, "auto")).toBeUndefined()
  })
})

describe("variantsFor", () => {
  const providers = [
    {
      id: "acme",
      name: "Acme",
      models: [{ id: "fast-1", name: "Fast 1", tags: [] as const, variants: ["low", "high"] }],
    },
  ]

  it("returns the model variants, or none for unknown values", () => {
    expect(variantsFor(providers as never, "acme/fast-1")).toEqual(["low", "high"])
    expect(variantsFor(providers as never, "acme/missing")).toEqual([])
    expect(variantsFor(providers as never, "auto")).toEqual([])
  })
})