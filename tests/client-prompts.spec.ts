import { describe, expect, test } from 'vitest'
import { addPrompt, buildSendLine, exportLibrary, getHistory, getPromptDetail, importLibrary, listPrompts, removePrompt, renamePrompt, restoreVersion, sortSummaries, updatePrompt } from '../src/client/prompts.js'

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
  test('正常返回目录（含统计）', async () => {
    const { fetchImpl } = stubFetch(true, { prompts: [{ name: 'deploy', description: '说明', useCount: 2, lastUsedAt: 1000 }] })
    expect(await listPrompts(fetchImpl)).toEqual([{ name: 'deploy', description: '说明', useCount: 2, lastUsedAt: 1000 }])
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

describe('sortSummaries', () => {
  test('用过按时间倒序，没用过按名称排最后', () => {
    expect(sortSummaries([
      { name: 'b', description: '', useCount: 0, lastUsedAt: null },
      { name: 'a', description: '', useCount: 1, lastUsedAt: 100 },
      { name: 'c', description: '', useCount: 5, lastUsedAt: 200 },
      { name: 'aa', description: '', useCount: 0, lastUsedAt: null },
    ]).map((row) => row.name)).toEqual(['c', 'a', 'aa', 'b'])
  })

  test('同时间按名称，不改原数组', () => {
    const rows = [
      { name: 'b', description: '', useCount: 1, lastUsedAt: 100 },
      { name: 'a', description: '', useCount: 2, lastUsedAt: 100 },
    ]
    const sorted = sortSummaries(rows)
    expect(sorted.map((row) => row.name)).toEqual(['a', 'b'])
    expect(rows.map((row) => row.name)).toEqual(['b', 'a'])
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

describe('updatePrompt', () => {
  test('POST 改内容', async () => {
    const { fetchImpl, seen } = stubFetch(true, { name: 'deploy' })
    await updatePrompt(fetchImpl, 'deploy', { body: '新正文' })
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/update')
    expect(JSON.parse(seen[0]?.init?.body as string)).toEqual({ name: 'deploy', body: '新正文' })
  })

  test('服务端拒绝把原文抛出来', async () => {
    const { fetchImpl } = stubFetch(false, { error: 'prompt "ghost" does not exist' }, 404)
    await expect(updatePrompt(fetchImpl, 'ghost', { body: 'x' })).rejects.toThrow('prompt "ghost" does not exist')
  })
})

describe('getPromptDetail', () => {
  test('正常返回全文', async () => {
    const { fetchImpl, seen } = stubFetch(true, { name: 'a', description: '说明', body: '正文' })
    expect(await getPromptDetail(fetchImpl, 'a')).toEqual({ name: 'a', description: '说明', body: '正文' })
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/a')
  })

  test('落空把服务端原文抛出来', async () => {
    const { fetchImpl } = stubFetch(false, { error: 'prompt "ghost" does not exist' }, 404)
    await expect(getPromptDetail(fetchImpl, 'ghost')).rejects.toThrow('prompt "ghost" does not exist')
  })

  test('形态不对抛错', async () => {
    const { fetchImpl } = stubFetch(true, { name: 'a' })
    await expect(getPromptDetail(fetchImpl, 'a')).rejects.toThrow()
  })
})

describe('buildSendLine', () => {
  test('无值只有命令', () => {
    expect(buildSendLine('deploy', {})).toBe('/p send deploy')
  })

  test('有值拼 k=v，含空格自动加引号', () => {
    expect(buildSendLine('review', { pr: '12', focus: '性能 安全' })).toBe('/p send review pr=12 focus="性能 安全"')
  })

  test('值含双引号直接拒绝（解析器 v1 无转义）', () => {
    expect(() => buildSendLine('review', { focus: 'say "hi"' })).toThrow('must not contain double quotes')
  })
})

describe('exportLibrary', () => {
  test('正常返回版本化文件体', async () => {
    const { fetchImpl, seen } = stubFetch(true, { version: 1, prompts: [{ name: 'a', description: '', body: '甲' }] })
    expect(await exportLibrary(fetchImpl)).toEqual({ version: 1, prompts: [{ name: 'a', description: '', body: '甲' }] })
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/export')
    expect(seen[0]?.init?.method).toBeUndefined()
  })

  test('形态不对与 HTTP 失败抛错', async () => {
    const bad = stubFetch(true, { version: 1, prompts: [{ name: 'a' }] })
    await expect(exportLibrary(bad.fetchImpl)).rejects.toThrow()
    const failed = stubFetch(false, {}, 500)
    await expect(exportLibrary(failed.fetchImpl)).rejects.toThrow('500')
  })
})

describe('importLibrary', () => {
  test('POST 文件体并返回清单', async () => {
    const file = { version: 1, prompts: [{ name: 'a', description: '', body: '甲' }] }
    const { fetchImpl, seen } = stubFetch(true, { added: ['a'], skipped: [] })
    expect(await importLibrary(fetchImpl, file)).toEqual({ added: ['a'], skipped: [] })
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/import')
    expect(JSON.parse(seen[0]?.init?.body as string)).toEqual(file)
  })

  test('服务端清单原文透出，形态不对抛错', async () => {
    const { fetchImpl } = stubFetch(true, { added: [], skipped: [{ name: 'a', reason: '重复' }] })
    expect(await importLibrary(fetchImpl, {})).toEqual({ added: [], skipped: [{ name: 'a', reason: '重复' }] })
    const bad = stubFetch(true, { added: 'x' })
    await expect(importLibrary(bad.fetchImpl, {})).rejects.toThrow()
  })
})

describe('getHistory', () => {
  test('正常返回版本数组', async () => {
    const { fetchImpl, seen } = stubFetch(true, { versions: [{ rev: 1, description: '', body: 'v1', at: 1000 }] })
    expect(await getHistory(fetchImpl, 'a')).toEqual([{ rev: 1, description: '', body: 'v1', at: 1000 }])
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/a/versions')
  })

  test('落空与形态不对抛错', async () => {
    const missing = stubFetch(false, { error: 'prompt "ghost" does not exist' }, 404)
    await expect(getHistory(missing.fetchImpl, 'ghost')).rejects.toThrow('prompt "ghost" does not exist')
    const bad = stubFetch(true, { versions: [{ rev: 'x' }] })
    await expect(getHistory(bad.fetchImpl, 'a')).rejects.toThrow()
  })
})

describe('restoreVersion', () => {
  test('POST 恢复', async () => {
    const { fetchImpl, seen } = stubFetch(true, { name: 'a', rev: 1 })
    await restoreVersion(fetchImpl, 'a', 1)
    expect(seen[0]?.url).toBe('/prompt-library/api/prompts/restore')
    expect(JSON.parse(seen[0]?.init?.body as string)).toEqual({ name: 'a', rev: 1 })
  })

  test('服务端拒绝原文透出', async () => {
    const { fetchImpl } = stubFetch(false, { error: 'prompt "a" has no version 9' }, 404)
    await expect(restoreVersion(fetchImpl, 'a', 9)).rejects.toThrow('prompt "a" has no version 9')
  })
})
