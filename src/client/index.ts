import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { promptDecoration } from './decorate.js'
import { promptTab } from './panel.js'
import type { PromptSidebarService } from './sidebar-faces.js'

/** 先备好的客户端服务：命令装饰面与会话面（apply 等它们就绪才跑）。 */
export const inject = ['commandUi', 'sessions']

/**
 * 客户端入口：给宿主 /p 挂弹窗装饰；侧边栏在场才挂管理页
 * （可选依赖——没装侧边栏不影响弹窗；侧边栏面按结构取用，
 * 与 P1 的 webServer 面同一处理）。
 * @param ctx - 客户端上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.commandUi.decorate(promptDecoration(ctx.sessions)))
  ctx.inject(['betterSidebar'], (scope) => {
    const sidebar = scope.get('betterSidebar') as PromptSidebarService
    scope.effect(() => sidebar.registerTab(promptTab()))
  })
}
