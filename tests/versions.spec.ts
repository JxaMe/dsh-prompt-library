import { describe, expect, test } from 'vitest'
import { VersionStore } from '../src/versions.js'
import { MemoryVersions } from './support/versions-memory.js'

describe('VersionStore', () => {
  test('保存后按倒序读回', async () => {
    const store = new VersionStore(new MemoryVersions(), () => 1000)
    await store.save('deploy', { description: '说明', body: 'v1' })
    await store.save('deploy', { description: '说明', body: 'v2' })
    expect(await store.history('deploy')).toEqual([
      { prompt: 'deploy', rev: 2, description: '说明', body: 'v2', at: 1000 },
      { prompt: 'deploy', rev: 1, description: '说明', body: 'v1', at: 1000 },
    ])
  })

  test('超 cap 剪掉最旧的', async () => {
    const store = new VersionStore(new MemoryVersions(), () => 0, 2)
    await store.save('a', { description: '', body: 'v1' })
    await store.save('a', { description: '', body: 'v2' })
    await store.save('a', { description: '', body: 'v3' })
    expect((await store.history('a')).map((row) => row.rev)).toEqual([3, 2])
  })

  test('改名搬运版本', async () => {
    const store = new VersionStore(new MemoryVersions(), () => 0)
    await store.save('a', { description: '', body: 'v1' })
    await store.move('a', 'b')
    expect(await store.history('a')).toEqual([])
    expect((await store.history('b')).map((row) => row.rev)).toEqual([1])
  })
})
