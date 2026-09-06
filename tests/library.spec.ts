import { describe, expect, test } from 'vitest'
import { PromptLibrary } from '../src/library.js'
import { PromptLibraryError } from '../src/errors.js'
import type { PromptRecord, PromptVault } from '../src/vault.js'
import { MemoryVault } from './support/vault-memory.js'

function library() {
  return new PromptLibrary(new MemoryVault(), { maxNameLength: 64, maxBodyChars: 100, maxCount: 10 })
}

describe('PromptLibrary', () => {
  test('存入后能按名取出', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '上线步骤', body: '第一步' })
    expect(await lib.get('deploy')).toEqual({ name: 'deploy', description: '上线步骤', body: '第一步' })
  })

  test('重名直接拒绝，不覆盖旧的', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '旧', body: '旧正文' })
    const failure = await lib.add({ name: 'deploy', description: '新', body: '新正文' }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(PromptLibraryError)
    expect((failure as PromptLibraryError).code).toBe('duplicate')
    expect(await lib.get('deploy')).toEqual({ name: 'deploy', description: '旧', body: '旧正文' })
  })

  test('名称中文大小写符号都行，唯独空白等号引号不行', async () => {
    const lib = library()
    await lib.add({ name: 'typeScript开发指南与快捷方式', description: '', body: '正文' })
    await lib.add({ name: 'Deploy', description: '', body: '正文' })
    await lib.add({ name: 'with!bang', description: '', body: '正文' })
    await lib.add({ name: '-lead', description: '', body: '正文' })
    expect(await lib.get('typeScript开发指南与快捷方式')).toEqual({ name: 'typeScript开发指南与快捷方式', description: '', body: '正文' })
    for (const bad of ['', 'with space', 'a=b', 'a"b', '前 后']) {
      const failure = await lib.add({ name: bad, description: '', body: '正文' }).catch((error: unknown) => error)
      expect(failure).toBeInstanceOf(PromptLibraryError)
      expect((failure as PromptLibraryError).code).toBe('invalid-name')
    }
  })

  test('正文超过上限拒绝并报出上限', async () => {
    const lib = library()
    const failure = await lib.add({ name: 'deploy', description: '', body: '正'.repeat(101) }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(PromptLibraryError)
    expect((failure as PromptLibraryError).code).toBe('body-too-long')
    expect(await lib.get('deploy')).toBeUndefined()
  })

  test('名称超过上限拒绝', async () => {
    const lib = library()
    const failure = await lib.add({ name: 'a'.repeat(65), description: '', body: '正文' }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(PromptLibraryError)
    expect((failure as PromptLibraryError).code).toBe('name-too-long')
  })

  test('存满后拒绝新增，但重名仍报重名', async () => {
    const lib = new PromptLibrary(new MemoryVault(), { maxNameLength: 64, maxBodyChars: 100, maxCount: 2 })
    await lib.add({ name: 'a', description: '', body: '甲' })
    await lib.add({ name: 'b', description: '', body: '乙' })
    const full = await lib.add({ name: 'c', description: '', body: '丙' }).catch((error: unknown) => error)
    expect((full as PromptLibraryError).code).toBe('too-many')
    const dup = await lib.add({ name: 'a', description: '', body: '甲2' }).catch((error: unknown) => error)
    expect((dup as PromptLibraryError).code).toBe('duplicate')
  })

  test('list 按名称排序返回全部', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '丙' })
    await lib.add({ name: 'ci', description: '', body: '甲' })
    await lib.add({ name: 'review', description: '', body: '乙' })
    expect(await lib.list()).toEqual([
      { name: 'ci', description: '', body: '甲' },
      { name: 'deploy', description: '', body: '丙' },
      { name: 'review', description: '', body: '乙' },
    ])
  })

  test('删存在的返回真，删不存在的返回假', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    expect(await lib.remove('deploy')).toBe(true)
    expect(await lib.get('deploy')).toBeUndefined()
    expect(await lib.remove('deploy')).toBe(false)
  })

  test('改名后旧名取不到新名能取到', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '说明', body: '正文' })
    await lib.rename('deploy', 'release')
    expect(await lib.get('deploy')).toBeUndefined()
    expect(await lib.get('release')).toEqual({ name: 'release', description: '说明', body: '正文' })
  })

  test('改名旧名不在报缺，新名被占报重', async () => {
    const lib = library()
    await lib.add({ name: 'b', description: '', body: '乙' })
    const missing = await lib.rename('a', 'c').catch((error: unknown) => error)
    expect((missing as PromptLibraryError).code).toBe('missing')
    const dup = await lib.rename('b', 'b').catch((error: unknown) => error)
    expect((dup as PromptLibraryError).code).toBe('duplicate')
  })

  test('改内容只换给定的字段', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '旧说明', body: '旧正文' })
    await lib.update('deploy', { body: '新正文' })
    expect(await lib.get('deploy')).toEqual({ name: 'deploy', description: '旧说明', body: '新正文' })
    await lib.update('deploy', { description: '新说明', body: '又新' })
    expect(await lib.get('deploy')).toEqual({ name: 'deploy', description: '新说明', body: '又新' })
  })

  test('改不存在的报缺，超长正文拒绝且不动旧值', async () => {
    const lib = library()
    const missing = await lib.update('ghost', { body: 'x' }).catch((error: unknown) => error)
    expect((missing as PromptLibraryError).code).toBe('missing')
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    const tooLong = await lib.update('deploy', { body: '正'.repeat(101) }).catch((error: unknown) => error)
    expect((tooLong as PromptLibraryError).code).toBe('body-too-long')
    expect(await lib.get('deploy')).toEqual({ name: 'deploy', description: '', body: '正文' })
  })

  test('介质故障原样上抛，不包装成库错误', async () => {
    const broken: PromptVault = {
      get: () => Promise.reject(new Error('disk gone')),
      put: () => Promise.reject(new Error('disk gone')),
      delete: () => Promise.reject(new Error('disk gone')),
      all: () => Promise.reject(new Error('disk gone')),
    }
    const lib = new PromptLibrary(broken, { maxNameLength: 64, maxBodyChars: 100, maxCount: 10 })
    await expect(lib.list()).rejects.toThrow('disk gone')
    await expect(lib.add({ name: 'a', description: '', body: '甲' })).rejects.toThrow('disk gone')
  })
})

describe('importMany', () => {
  test('混合批次逐条裁决，永不覆盖', async () => {
    const lib = library()
    await lib.add({ name: 'old', description: '', body: '旧' })
    const result = await lib.importMany([
      { name: 'a', description: '甲', body: '甲正文' },
      { name: 'old', body: '想覆盖' },
      { name: 'Bad Name', body: 'x' },
      { name: 'a', body: '批内重名' },
      null,
      { name: 'b', body: '乙正文' },
    ])
    expect(result.added).toEqual(['a', 'b'])
    expect(result.skipped).toEqual([
      { name: 'old', reason: 'prompt "old" already exists' },
      { name: 'Bad Name', reason: 'invalid prompt name "Bad Name": must not contain whitespace, = or "' },
      { name: 'a', reason: 'prompt "a" already exists' },
      { name: '(unknown)', reason: 'invalid prompt payload' },
    ])
    expect(await lib.get('old')).toEqual({ name: 'old', description: '', body: '旧' })
    expect(await lib.get('b')).toEqual({ name: 'b', description: '', body: '乙正文' })
  })

  test('满额后剩余全跳过', async () => {
    const lib = new PromptLibrary(new MemoryVault(), { maxNameLength: 64, maxBodyChars: 100, maxCount: 1 })
    const result = await lib.importMany([
      { name: 'a', body: '甲' },
      { name: 'b', body: '乙' },
    ])
    expect(result.added).toEqual(['a'])
    expect(result.skipped).toEqual([{ name: 'b', reason: 'prompt library is full (limit is 1)' }])
  })
})
