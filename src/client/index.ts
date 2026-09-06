import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { promptDecoration } from './decorate.js'
import { promptTab } from './panel.js'
import { promptTriggerSource } from './trigger.js'
import type { PromptSidebarService } from './sidebar-faces.js'

/** 先备好的客户端服务：命令装饰面与会话面（apply 等它们就绪才跑）。 */
export const inject = ['commandUi', 'sessions']

/**
 * 客户端入口：给宿主 /p 挂弹窗装饰；侧边栏在场才挂管理页，
 * 触发器在场才挂 @ 源（都是可选依赖——缺谁都不影响剩下的）。
 * @param ctx - 客户端上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.commandUi.decorate(promptDecoration(ctx.sessions)))
  ctx.inject(['betterSidebar'], (scope) => {
    const sidebar = scope.get('betterSidebar') as PromptSidebarService | undefined
    if (sidebar === undefined) return
    scope.effect(() => sidebar.registerTab(promptTab()))
  })
  ctx.inject(['inputTriggers'], (scope) => {
    const triggers = scope.get('inputTriggers') as {
      registerSource(source: InputTriggerSource): () => void
    } | undefined
    if (triggers === undefined) return
    scope.effect(() => triggers.registerSource(promptTriggerSource()))
  })
}
