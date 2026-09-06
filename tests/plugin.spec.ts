import { describe, expect, test } from 'vitest'
import * as plugin from '../src/index.js'

describe('plugin module', () => {
  test('函数插件形态：命名导出且无 default', () => {
    expect(plugin.name).toBe('dsh-prompt-library')
    expect(plugin.inject).toContain('commands')
    expect(plugin.inject).toContain('storageDomain')
    expect(typeof plugin.apply).toBe('function')
    expect('default' in plugin).toBe(false)
  })
})
