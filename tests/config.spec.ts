import { describe, expect, test } from 'vitest'
import { Config } from '../src/config.js'

describe('Config', () => {
  test('空配置落默认值', () => {
    expect(Config({})).toEqual({ maxNameLength: 64, maxBodyChars: 20000, maxCount: 500 })
  })

  test('合法自定义通过', () => {
    expect(Config({ maxCount: 10 })).toEqual({ maxNameLength: 64, maxBodyChars: 20000, maxCount: 10 })
  })

  test('非正整数拒绝', () => {
    expect(() => Config({ maxCount: 0 })).toThrow()
    expect(() => Config({ maxBodyChars: -1 })).toThrow()
    expect(() => Config({ maxNameLength: 1.5 })).toThrow()
  })
})
