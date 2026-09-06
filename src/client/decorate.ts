import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { CommandDecoration } from '@deepseek-ai/dsh-client-ui-commands/client'
import { listPrompts } from './prompts.js'
import type { FetchImpl } from './prompts.js'

/**
 * /p 的客户端装饰：裸调用弹提示词列表，选中即提交 `/p send` 执行。
 * 装饰不产新命令——/p 的注册、参数 claim 与日志仍归 Host 所有。
 * @param sessions - 会话服务（取当前会话的执行面）。
 * @param fetchImpl - 目录请求实现，默认全局 fetch。
 * @returns 挂给 commandUi.decorate 的装饰。
 */
export function promptDecoration(
  sessions: Pick<ISessions, 'binding'>,
  fetchImpl: FetchImpl = globalThis.fetch,
): CommandDecoration {
  return {
    name: 'p',
    available: () => true,
    ui: {
      kind: 'popupSelect',
      options: async () => {
        const summaries = await listPrompts(fetchImpl)
        return summaries.map((summary) => ({
          id: summary.name,
          label: summary.name,
          detail: summary.description === '' ? undefined : summary.description,
        }))
      },
      onSelect: async (option, session) => {
        const live = sessions.binding(session.sessionId)?.session
        if (live === undefined) throw new Error('会话尚未就绪，请稍后再试')
        const result = await live.command(`/p send ${option.id}`)
        if (!result.ok) throw new Error(`发送失败：${result.error.message}`)
        if (!result.value.matched) throw new Error('宿主没有 /p 命令，请确认插件已挂载')
      },
    },
  }
}
