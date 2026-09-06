import { describe, expect, test } from 'vitest'
import { extractVariables, renderTemplate } from '../src/template.js'

describe('extractVariables', () => {
  test('无占位返回空', () => {
    expect(extractVariables('纯文本')).toEqual([])
  })

  test('提取占位名，去重保首次序', () => {
    expect(extractVariables('Review {{pr}}，重点看 {{focus}}，再看 {{pr}}')).toEqual(['pr', 'focus'])
  })

  test('花括号内空白忽略，未闭合当字面', () => {
    expect(extractVariables('看 {{ pr }} 和 {{focus')).toEqual(['pr'])
  })

  test('非法名不算变量', () => {
    expect(extractVariables('{{pr-id}} {{a b}} {{}}')).toEqual([])
  })
})

describe('renderTemplate', () => {
  test('无变量原文返回', () => {
    expect(renderTemplate('纯文本', {} as Record<string, string>)).toEqual({ ok: true, text: '纯文本' })
  })

  test('齐了就渲染，含空格的占位也替换', () => {
    expect(renderTemplate('看 {{ pr }} 的 {{focus}}', { pr: '12', focus: '安全' }))
      .toEqual({ ok: true, text: '看 12 的 安全' })
  })

  test('缺谁报谁，多给的忽略', () => {
    expect(renderTemplate('{{a}} 和 {{b}}', { a: '1', extra: 'x' }))
      .toEqual({ ok: false, missing: ['b'] })
  })
})
