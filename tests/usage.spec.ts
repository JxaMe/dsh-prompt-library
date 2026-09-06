import { describe, expect, test } from 'vitest'
import { UsageStats } from '../src/usage.js'
import { MemoryUsage } from './support/usage-memory.js'

describe('UsageStats', () => {
  test('首次记录次数 1 并打时间戳', async () => {
    const stats = new UsageStats(new MemoryUsage(), () => 1000)
    await stats.recordUse('deploy')
    expect(await stats.get('deploy')).toEqual({ name: 'deploy', count: 1, lastUsedAt: 1000 })
  })

  test('重复记录累加次数并刷新时间', async () => {
    let now = 1000
    const stats = new UsageStats(new MemoryUsage(), () => now)
    await stats.recordUse('deploy')
    now = 2000
    await stats.recordUse('deploy')
    expect(await stats.get('deploy')).toEqual({ name: 'deploy', count: 2, lastUsedAt: 2000 })
  })

  test('没用过返回 undefined', async () => {
    expect(await new UsageStats(new MemoryUsage(), () => 0).get('ghost')).toBeUndefined()
  })
})
