import { Plugin, SettingsPage, Style } from "@opencode/plugin/gui"
import { registerCommands } from "./gui/commands.js"
import { createController } from "./gui/controller.js"
import { definition } from "./gui/definition.js"
import { createDraftComposer } from "./gui/draft.js"
import { registerOutline } from "./gui/outline.js"
import { createSettingsPage, SETTINGS_STYLE } from "./gui/settings.js"
import { mountToolbarButton } from "./gui/toolbar.js"

const setup: Plugin.Setup<typeof definition> = (ctx) => {
  const draft = createDraftComposer()
  const controller = createController(ctx, draft)
  const outline = registerOutline(ctx)

  registerCommands(ctx, controller, outline)
  ctx.add(SettingsPage, createSettingsPage(ctx))
  ctx.add(Style, SETTINGS_STYLE)

  return mountToolbarButton(ctx, controller)
}

export default Plugin.define({
  ...definition,
  setup,
})