import { describe, expect, test } from 'vitest'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { appendToDraft, insertToDraft } from '../src/client/draft.js'

describe('insertToDraft', () => {
  test('空草稿直接放，全空白也算空', () => {
    expect(insertToDraft('', '正文')).toBe('正文')
    expect(insertToDraft('   ', '正文')).toBe('正文')
  })

  test('非空草稿空格拼接（与 @引用同一写法）', () => {
    expect(insertToDraft('已有', '正文')).toBe('已有 正文')
  })
})

/** 会话与会话输入桩。 */
function stubDraft(draft: string, scope: unknown = {}) {
  const written: string[] = []
  const sessions = { scope: (_id: unknown): unknown => scope }
  const conversation = {
    input: {
      for: (_s: unknown) => ({
        state: { getSnapshot: () => ({ draft }) },
        setDraft: (text: string): void => { written.push(text) },
      }),
    },
  }
  return { sessions, conversation, written }
}

const sessionId = 's1' as SessionId

describe('appendToDraft', () => {
  test('空草稿写入正文', () => {
    const { sessions, conversation, written } = stubDraft('')
    expect(appendToDraft({ sessions, conversation }, sessionId, '正文')).toBe(true)
    expect(written).toEqual(['正文'])
  })

  test('非空草稿空格拼接', () => {
    const { sessions, conversation, written } = stubDraft('已有')
    expect(appendToDraft({ sessions, conversation }, sessionId, '正文')).toBe(true)
    expect(written).toEqual(['已有 正文'])
  })

  test('没会话作用域返回假，不写', () => {
    const sessions = { scope: (_id: unknown): unknown => undefined }
    const { conversation, written } = stubDraft('')
    expect(appendToDraft({ sessions, conversation }, sessionId, '正文')).toBe(false)
    expect(written).toEqual([])
  })

  test('没会话服务返回假，不写', () => {
    const { sessions, written } = stubDraft('')
    expect(appendToDraft({ sessions, conversation: undefined }, sessionId, '正文')).toBe(false)
    expect(written).toEqual([])
  })
})
