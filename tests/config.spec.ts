import { describe, expect, test } from 'vitest'
import { Config } from '../src/config.js'

describe('Config', () => {
  test('空配置落默认值', () => {
    expect(Config({})).toEqual({ maxNameLength: 64, maxBodyChars: 20000, maxCount: 500, versionHistory: 20 })
  })

  test('合法自定义通过，版本历史可关', () => {
    expect(Config({ maxCount: 10 })).toEqual({ maxNameLength: 64, maxBodyChars: 20000, maxCount: 10, versionHistory: 20 })
    expect(Config({ versionHistory: 0 }).versionHistory).toBe(0)
  })

  test('非正整数拒绝', () => {
    expect(() => Config({ maxCount: 0 })).toThrow()
    expect(() => Config({ maxBodyChars: -1 })).toThrow()
    expect(() => Config({ maxNameLength: 1.5 })).toThrow()
    expect(() => Config({ versionHistory: -1 })).toThrow()
  })
})
