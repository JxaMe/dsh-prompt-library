import type { Context as ClientContext } from '@deepseek-ai/cordis'
import { promptDecoration } from './decorate.js'

/** 先备好的客户端服务：命令装饰面与会话面（apply 等它们就绪才跑）。 */
export const inject = ['commandUi', 'sessions']

/**
 * 客户端入口：给宿主 /p 挂弹窗装饰。无 name/Config——装饰挂在宿主命令上。
 * @param ctx - 客户端上下文。
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.commandUi.decorate(promptDecoration(ctx.sessions)))
}
