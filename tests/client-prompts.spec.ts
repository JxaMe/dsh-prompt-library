import { describe, expect, test } from 'vitest'
import { addPrompt, listPrompts, removePrompt, renamePrompt } from '../src/client/prompts.js'

/** 桩 fetch：状态与 JSON 体可配，收到的请求可查。 */
function stubFetch(ok: boolean, payload: unknown, status = 200) {
  const seen: Array<{ url: string; init?: RequestInit }> = []
  const fetchImpl = async (url: string, init?: RequestInit): Promise<Response> => {
    seen.push({ url, init })
    return {
      ok,
      status,
      json: async (): Promise<unknown> => payload,
    } as Response
  }
  return { fetchImpl, seen }
}

describe('listPrompts', () => {
  test('正常返回目录', async () => {
    const { fetchImpl } = stubFetch(true, { prompts: [{ name: 'deploy', description: '说明' }] })
    expect(await listPrompts(fetchImpl)).toEqual([{ name: 'deploy', description: '说明' }])
  })

  test('HTTP 失败抛错并带状态码', async () => {
    const { fetchImpl } = stubFetch(false, {}, 403)
    await expect(listPrompts(fetchImpl)).rejects.toThrow('403')
  })

  test('形态不对抛错', async () => {
    const bad1 = stubFetch(true, { prompts: [{ name: 'deploy' }] })
    await expect(listPrompts(bad1.fetchImpl)).rejects.toThrow()
    const bad2 = stubFetch(true, { prompts: 'nope' })
    await expect(listPrompts(bad2.fetchImpl)).rejects.toThrow()
    const bad3 = stubFetch(true, null)
    await expect(listPrompts(bad3.fetchImpl)).rejects.toThrow()
  })
})

describe('addPrompt', () => {
  test('POST 新增并返回名称', async () => {
    const { fetchImpl, seen } = stubFetch(true, { name: 'deploy' })
    expect(await addPrompt(fetchImpl, { name: 'deploy', description: '', body: '正文' })).toBe('deploy')
    expect(seen).toHaveLength(1)
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/add')
    expect(seen[0]?.init?.method).toBe('POST')
    expect(JSON.parse(seen[0]?.init?.body as string)).toEqual({ name: 'deploy', description: '', body: '正文' })
  })

  test('服务端拒绝把原文抛出来', async () => {
    const { fetchImpl } = stubFetch(false, { error: 'prompt "deploy" already exists' }, 400)
    await expect(addPrompt(fetchImpl, { name: 'deploy', body: '新' })).rejects.toThrow('prompt "deploy" already exists')
  })

  test('形态不对抛错', async () => {
    const { fetchImpl } = stubFetch(true, { nope: 1 })
    await expect(addPrompt(fetchImpl, { name: 'a', body: 'b' })).rejects.toThrow()
  })
})

describe('removePrompt', () => {
  test('POST 删除', async () => {
    const { fetchImpl, seen } = stubFetch(true, { removed: true })
    await removePrompt(fetchImpl, 'deploy')
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/remove')
    expect(JSON.parse(seen[0]?.init?.body as string)).toEqual({ name: 'deploy' })
  })

  test('服务端拒绝把原文抛出来', async () => {
    const { fetchImpl } = stubFetch(false, { error: 'prompt "ghost" does not exist' }, 404)
    await expect(removePrompt(fetchImpl, 'ghost')).rejects.toThrow('prompt "ghost" does not exist')
  })
})

describe('renamePrompt', () => {
  test('POST 改名并返回新名', async () => {
    const { fetchImpl, seen } = stubFetch(true, { name: 'release' })
    expect(await renamePrompt(fetchImpl, 'deploy', 'release')).toBe('release')
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/rename')
    expect(JSON.parse(seen[0]?.init?.body as string)).toEqual({ from: 'deploy', to: 'release' })
  })

  test('服务端拒绝把原文抛出来', async () => {
    const { fetchImpl } = stubFetch(false, { error: 'prompt "a" does not exist' }, 404)
    await expect(renamePrompt(fetchImpl, 'a', 'b')).rejects.toThrow('prompt "a" does not exist')
  })
})
