import { describe, expect, test } from 'vitest'
import type { ClientSessionContext } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { promptTriggerSource } from '../src/client/trigger.js'

const session = { sessionId: 's1' as SessionId } as ClientSessionContext
const span = { start: 0, end: 2, draftRev: 1 }

/** 按 URL 分发的桩 fetch：目录与单条各给各的（同一记录两边一致）。 */
const RECORDS = [
  { name: 'deploy', description: '上线', body: '部署正文' },
  { name: 'review', description: '评审', body: '评审正文' },
] as const

function stubFetch() {
  const seen: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    seen.push({ url, init })
    const tail = url.split('/').pop() ?? ''
    const payload = url.endsWith('/prompts')
      ? { prompts: [
        { name: 'deploy', description: '上线', useCount: 0, lastUsedAt: null },
        { name: 'review', description: '评审', useCount: 5, lastUsedAt: 2000 },
      ] }
      : (RECORDS.find((row) => row.name === tail) ?? { name: tail, description: '', body: `正文:${tail}` })
    return { ok: true, status: 200, json: async (): Promise<unknown> => payload } as Response
  }
  return { fetchImpl, seen }
}

function request(query: string, signal?: AbortSignal) {
  return { query, position: 'leading' as const, drilled: false, signal: signal ?? new AbortController().signal }
}

describe('promptTriggerSource candidates', () => {
  test('按查询过滤，行里带正文载荷', async () => {
    const { fetchImpl } = stubFetch()
    const source = promptTriggerSource(fetchImpl)
    const rows = await source.candidates(session, request('dep'))
    expect(rows).toHaveLength(1)
    expect(rows[0]?.name).toBe('deploy')
    expect(rows[0]?.description).toBe('上线')
  })

  test('无说明显示正文首行', async () => {
    const fetchImpl = async (url: string): Promise<Response> => ({
      ok: true,
      status: 200,
      json: async (): Promise<unknown> => url.endsWith('/prompts')
        ? { prompts: [{ name: 'a', description: '', useCount: 0, lastUsedAt: null }] }
        : { name: 'a', description: '', body: '第一行\n第二行' },
    }) as Response
    const source = promptTriggerSource(fetchImpl)
    const rows = await source.candidates(session, request('a'))
    expect(rows[0]?.description).toBe('第一行')
  })

  test('空查询封顶 20 行', async () => {
    const fetchImpl = async (url: string): Promise<Response> => {
      const tail = url.split('/').pop() ?? ''
      const payload = url.endsWith('/prompts')
        ? { prompts: Array.from({ length: 25 }, (_, i) => ({ name: `p${i}`, description: '', useCount: 0, lastUsedAt: null })) }
        : { name: tail, description: '', body: `正文:${tail}` }
      return {
        ok: true,
        status: 200,
        json: async (): Promise<unknown> => payload,
      } as Response
    }
    const source = promptTriggerSource(fetchImpl)
    const rows = await source.candidates(session, request(''))
    expect(rows).toHaveLength(20)
  })

  test('请求带上 abort 信号', async () => {
    const { fetchImpl, seen } = stubFetch()
    const controller = new AbortController()
    const source = promptTriggerSource(fetchImpl)
    await source.candidates(session, request('dep', controller.signal))
    expect(seen[0]?.init?.signal).toBe(controller.signal)
  })

  test('信号已取消返回空', async () => {
    const { fetchImpl } = stubFetch()
    const controller = new AbortController()
    controller.abort()
    const source = promptTriggerSource(fetchImpl)
    expect(await source.candidates(session, request('dep', controller.signal))).toEqual([])
  })
})

describe('promptTriggerSource onPick', () => {
  test('选中插入正文', async () => {
    const { fetchImpl } = stubFetch()
    const source = promptTriggerSource(fetchImpl)
    const rows = await source.candidates(session, request('dep'))
    const outcome = source.onPick({ candidate: rows[0]!, session, position: 'leading', via: 'menu', action: 'pick', span })
    expect(outcome).toEqual({ text: '部署正文' })
  })

  test('坏载荷不崩溃', async () => {
    const source = promptTriggerSource(stubFetch().fetchImpl)
    expect(source.onPick({ candidate: { name: 'x', value: 'not-json' }, session, position: 'leading', via: 'menu', action: 'pick', span }))
      .toBeUndefined()
  })
})
