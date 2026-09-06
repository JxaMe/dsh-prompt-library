import { describe, expect, test } from 'vitest'
import { parsePromptArgs } from '../src/parse.js'

describe('parsePromptArgs', () => {
  test('空输入列出全部提示词', () => {
    expect(parsePromptArgs('')).toEqual({ kind: 'list' })
  })

  test('显式 list 忽略首尾空白', () => {
    expect(parsePromptArgs(' list ')).toEqual({ kind: 'list' })
  })

  test('show 带一个名称', () => {
    expect(parsePromptArgs(' show deploy ')).toEqual({ kind: 'show', name: 'deploy' })
  })

  test('show 缺名称或多给都算错', () => {
    expect(parsePromptArgs(' show ')).toEqual({ kind: 'invalid', reason: 'usage: /p show <name>' })
    expect(parsePromptArgs(' show a b ')).toEqual({ kind: 'invalid', reason: 'usage: /p show <name>' })
  })

  test('send 带一个名称，缺参算错', () => {
    expect(parsePromptArgs(' send deploy ')).toEqual({ kind: 'send', name: 'deploy', values: {} })
    expect(parsePromptArgs(' send ')).toEqual({ kind: 'invalid', reason: 'usage: /p send <name> [key=value ...]' })
  })

  test('send 赋值按 k=v 切，双引号分组不断开', () => {
    expect(parsePromptArgs(' send review pr=12 focus=安全 ')).toEqual({
      kind: 'send', name: 'review', values: { pr: '12', focus: '安全' },
    })
    expect(parsePromptArgs(' send review focus="性能 安全" ')).toEqual({
      kind: 'send', name: 'review', values: { focus: '性能 安全' },
    })
  })

  test('send 赋值没等号或键非法都算错', () => {
    expect(parsePromptArgs(' send review bare ')).toEqual({ kind: 'invalid', reason: 'usage: /p send <name> [key=value ...]' })
    expect(parsePromptArgs(' send review bad-key=1 ')).toEqual({ kind: 'invalid', reason: 'usage: /p send <name> [key=value ...]' })
  })

  test('add 正文保留内部换行', () => {
    expect(parsePromptArgs(' add deploy 你好\n第二行 ')).toEqual({ kind: 'add', name: 'deploy', body: '你好\n第二行' })
  })

  test('add 缺名称或缺正文都算错', () => {
    expect(parsePromptArgs(' add ')).toEqual({ kind: 'invalid', reason: 'usage: /p add <name> <body>' })
    expect(parsePromptArgs(' add deploy ')).toEqual({ kind: 'invalid', reason: 'usage: /p add <name> <body>' })
  })

  test('rm 带一个名称，缺参算错', () => {
    expect(parsePromptArgs(' rm deploy ')).toEqual({ kind: 'rm', name: 'deploy' })
    expect(parsePromptArgs(' rm ')).toEqual({ kind: 'invalid', reason: 'usage: /p rm <name>' })
  })

  test('rename 带两个名称，缺参算错', () => {
    expect(parsePromptArgs(' rename a b ')).toEqual({ kind: 'rename', from: 'a', to: 'b' })
    expect(parsePromptArgs(' rename a ')).toEqual({ kind: 'invalid', reason: 'usage: /p rename <old> <new>' })
  })

  test('未知子命令算错并给用法', () => {
    expect(parsePromptArgs(' bogus ')).toEqual({ kind: 'invalid', reason: 'usage: /p list | show <name> | send <name> [key=value ...] | add <name> <body> | rm <name> | rename <old> <new>' })
  })
})
