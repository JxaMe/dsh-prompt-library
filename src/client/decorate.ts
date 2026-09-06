import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { CommandDecoration } from '@deepseek-ai/dsh-client-ui-commands/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { listPrompts, sortSummaries } from './prompts.js'
import type { FetchImpl } from './prompts.js'

/**
 * 提交一行 /p 命令给会话执行。会话缺席、提交失败、宿主无此命令全部抛错，
 * 调用方（弹窗/面板）负责展示。
 * @param sessions - 会话服务（可缺席，缺席即抛）。
 * @param sessionId - 会话 id。
 * @param line - 完整命令行。
 */
export async function submitSendLine(
  sessions: Pick<ISessions, 'binding'> | undefined,
  sessionId: SessionId,
  line: string,
): Promise<void> {
  const live = sessions?.binding(sessionId)?.session
  if (live === undefined) throw new Error('会话尚未就绪，请稍后再试')
  const result = await live.command(line)
  if (!result.ok) throw new Error(`发送失败：${result.error.message}`)
  if (!result.value.matched) throw new Error('宿主没有 /p 命令，请确认插件已挂载')
}

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
        return sortSummaries(summaries).map((summary) => ({
          id: summary.name,
          label: summary.name,
          detail: summary.description === '' ? undefined : summary.description,
        }))
      },
      onSelect: async (option, session) => {
        await submitSendLine(sessions, session.sessionId, `/p send ${option.id}`)
      },
    },
  }
}
