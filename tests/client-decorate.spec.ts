import { describe, expect, test } from 'vitest'
import type { ISessions } from '@deepseek-ai/dsh-api-session-controller/client'
import type { ClientSessionContext } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { RemoteError } from '@deepseek-ai/dsh-typert-protocol'
import { promptDecoration } from '../src/client/decorate.js'

/** 目录 fetch 桩。 */
function stubFetch(payload: unknown) {
  return async (): Promise<Response> => ({
    ok: true,
    status: 200,
    json: async (): Promise<unknown> => payload,
  }) as Response
}

const session = { sessionId: 's1' as SessionId } as ClientSessionContext

/** 会话面桩：command 调用可配，收到的行可查。 */
function stubSessions(command: (line: string) => unknown) {
  const lines: string[] = []
  const sessions = {
    binding: () => ({
      session: {
        command: async (line: string): Promise<unknown> => {
          lines.push(line)
          return command(line)
        },
      },
    }),
  } as unknown as Pick<ISessions, 'binding'>
  return { sessions, lines }
}

describe('promptDecoration options', () => {
  test('目录行转弹窗选项，无说明不带 detail', async () => {
    const fetchImpl = stubFetch({ prompts: [{ name: 'b', description: '' }, { name: 'a', description: '说明' }] })
    const decoration = promptDecoration(stubSessions(() => {}).sessions, fetchImpl)
    const options = await decoration.ui.options(session, new AbortController().signal)
    expect(options).toEqual([
      { id: 'b', label: 'b', detail: undefined },
      { id: 'a', label: 'a', detail: '说明' },
    ])
  })
})

describe('promptDecoration onSelect', () => {
  test('选中提交 /p send 行', async () => {
    const { sessions, lines } = stubSessions(() => ({ ok: true, value: { matched: true } }))
    const decoration = promptDecoration(sessions, stubFetch({ prompts: [] }))
    await decoration.ui.onSelect({ id: 'deploy', label: 'deploy' }, session)
    expect(lines).toEqual(['/p send deploy'])
  })

  test('会话未就绪抛错且不提交', async () => {
    const sessions = { binding: () => undefined } as unknown as Pick<ISessions, 'binding'>
    const decoration = promptDecoration(sessions, stubFetch({ prompts: [] }))
    await expect(decoration.ui.onSelect({ id: 'deploy', label: 'deploy' }, session))
      .rejects.toThrow('会话尚未就绪')
  })

  test('提交失败把原因抛给弹窗', async () => {
    const { sessions } = stubSessions(() => ({
      ok: false,
      error: new RemoteError('gateway/internal', 'boom', {}),
    }))
    const decoration = promptDecoration(sessions, stubFetch({ prompts: [] }))
    await expect(decoration.ui.onSelect({ id: 'deploy', label: 'deploy' }, session))
      .rejects.toThrow('boom')
  })

  test('宿主没有 /p 时明说', async () => {
    const { sessions } = stubSessions(() => ({ ok: true, value: { matched: false } }))
    const decoration = promptDecoration(sessions, stubFetch({ prompts: [] }))
    await expect(decoration.ui.onSelect({ id: 'deploy', label: 'deploy' }, session))
      .rejects.toThrow('宿主没有 /p 命令')
  })
})
