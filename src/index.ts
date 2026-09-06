import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-storage-domain'
import { buildPromptCommand } from './commands.js'
import { Config } from './config.js'
import { PromptLibrary } from './library.js'
import { registerPromptRoutes } from './routes.js'
import type { PromptRouteServer } from './routes.js'
import { UsageStats } from './usage.js'
import { PROMPT_DOMAIN, DomainVault } from './vault-domain.js'

export { Config }

declare module '@deepseek-ai/cordis' {
  interface Context {
    prompts: PromptLibrary
  }
}

/** cordis.yml 挂载名。 */
export const name = 'dsh-prompt-manager'

/** 先备好的服务：命令注册表与存储域。 */
export const inject = ['commands', 'storageDomain']

/**
 * 挂载：开域 → 建库 → 公开服务 → 注册 /p。域打不开直接失败，
 * 不带病运行；Config 即库上限（同三个字段，结构直传）。
 * @param ctx - 插件上下文。
 * @param config - 校验过的配置。
 */
export async function apply(ctx: Context, config: Config): Promise<void> {
  const domain = await ctx.storageDomain.open(PROMPT_DOMAIN)
  const library = new PromptLibrary(new DomainVault(domain.table('prompts')), config)
  const usage = new UsageStats(new DomainVault(domain.table('usage')), Date.now)
  ctx.provide('prompts', library)
  ctx.effect(() => ctx.commands.register(buildPromptCommand(library, usage)))
  ctx.effect(() => () => domain.close())
  // HTTP 路由是有 web 栈才有的东西：headless 下这个 inject 永不触发，命令不受影响。
  // 受信列表每次请求现读，跟随 webRuntime 的最新值。
  ctx.inject(['webServer', 'webRuntime'], (webCtx) => {
    // webServer/webRuntime 归别的包所有，这里只按结构取用（get 的 string 重载返回 any，转一次即收敛到命名面）。
    const webServer = webCtx.get('webServer') as PromptRouteServer
    const trustedHosts = (): readonly string[] => {
      const runtime = webCtx.get('webRuntime') as { trustedHosts?: readonly string[] } | undefined
      return runtime?.trustedHosts ?? []
    }
    webCtx.effect(() => registerPromptRoutes(webServer, trustedHosts, library, usage))
  })
}
