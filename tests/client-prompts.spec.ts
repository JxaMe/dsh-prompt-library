import { describe, expect, test } from 'vitest'
import { listPrompts } from '../src/client/prompts.js'

/** 桩 fetch：状态与 JSON 体可配。 */
function stubFetch(ok: boolean, payload: unknown, status = 200) {
  return async (): Promise<Response> => ({
    ok,
    status,
    json: async (): Promise<unknown> => payload,
  }) as Response
}

describe('listPrompts', () => {
  test('正常返回目录', async () => {
    const fetchImpl = stubFetch(true, { prompts: [{ name: 'deploy', description: '说明' }] })
    expect(await listPrompts(fetchImpl)).toEqual([{ name: 'deploy', description: '说明' }])
  })

  test('HTTP 失败抛错并带状态码', async () => {
    await expect(listPrompts(stubFetch(false, {}, 403))).rejects.toThrow('403')
  })

  test('形态不对抛错', async () => {
    await expect(listPrompts(stubFetch(true, { prompts: [{ name: 'deploy' }] }))).rejects.toThrow()
    await expect(listPrompts(stubFetch(true, { prompts: 'nope' }))).rejects.toThrow()
    await expect(listPrompts(stubFetch(true, null))).rejects.toThrow()
  })
})
