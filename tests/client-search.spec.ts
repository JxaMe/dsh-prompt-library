import { describe, expect, test } from 'vitest'
import { matchPrompt } from '../src/client/search.js'

describe('matchPrompt', () => {
  test('空查询全过', () => {
    expect(matchPrompt({ name: '部署', description: '' }, '')).toBe(true)
    expect(matchPrompt({ name: '部署', description: '' }, '   ')).toBe(true)
  })

  test('中英文子串照旧', () => {
    expect(matchPrompt({ name: 'deploy上线', description: '' }, 'deploy')).toBe(true)
    expect(matchPrompt({ name: '部署', description: '上线步骤' }, '步骤')).toBe(true)
    expect(matchPrompt({ name: '部署', description: '' }, 'xyz')).toBe(false)
  })

  test('拼音全拼命中', () => {
    expect(matchPrompt({ name: '部署指南', description: '' }, 'bushu')).toBe(true)
  })

  test('拼音首字母命中', () => {
    expect(matchPrompt({ name: '部署指南', description: '' }, 'bszn')).toBe(true)
  })

  test('说明也参与拼音匹配', () => {
    expect(matchPrompt({ name: 'a', description: '上线步骤' }, 'sx')).toBe(true)
  })
})
