import type { Context } from '@deepseek-ai/cordis'
import type {} from '@deepseek-ai/dsh-commands'
import type {} from '@deepseek-ai/dsh-storage-domain'
import { buildPromptCommand } from './commands.js'
import { Config } from './config.js'
import { PromptLibrary } from './library.js'
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
  ctx.provide('prompts', library)
  ctx.effect(() => ctx.commands.register(buildPromptCommand(library)))
  ctx.effect(() => () => domain.close())
}
