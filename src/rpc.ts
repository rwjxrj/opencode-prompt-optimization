import { Rpc } from "@opencode/plugin/rpc"
import type { OptimizeInput } from "./types.js"

const composerModelSchema = {
  type: "object",
  properties: {
    providerID: { type: "string" },
    modelID: { type: "string" },
    variant: { type: "string" },
  },
  required: ["providerID", "modelID"],
  additionalProperties: false,
} as const

export const PromptOptimization = Rpc.define({
  id: "prompt-optimization",
  events: {},
  methods: {
    optimize: {
      input: {
        type: "object",
        properties: {
          // The GUI masks `@refs` and a leading `/command` as `[[refN]]`; the reply must keep every placeholder.
          text: { type: "string" },
          mode: { enum: ["concise", "full"] },
          round: { type: "integer", minimum: 1 },
          previous: { type: "string" },
          sessionID: { type: "string" },
          directory: { type: "string" },
          composerModel: composerModelSchema,
          modelPreference: { type: "string" },
          variant: { type: "string" },
          projectContext: { type: "boolean" },
        },
        required: ["text", "mode", "round"],
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          ok: { type: "boolean" },
          text: { type: "string" },
          model: { type: "string" },
          code: { type: "string" },
          message: { type: "string" },
        },
        required: ["ok"],
        additionalProperties: false,
      },
    },
    catalog: {
      input: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      output: {
        type: "object",
        properties: {
          providers: {
            type: "array",
            items: {
              type: "object",
              properties: {
                id: { type: "string" },
                name: { type: "string" },
                models: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "string" },
                      name: { type: "string" },
                      context: { type: "integer" },
                      tags: { type: "array", items: { enum: ["reasoning", "fast"] } },
                      variants: { type: "array", items: { type: "string" } },
                      recommended: { type: "boolean" },
                    },
                    required: ["id", "name", "tags"],
                    additionalProperties: false,
                  },
                },
              },
              required: ["id", "name", "models"],
              additionalProperties: false,
            },
          },
        },
        required: ["providers"],
        additionalProperties: false,
      },
    },
  },
})

export type PromptOptimizationInput = OptimizeInput
