import { describe, expect, test } from 'vitest'
import { buildPromptCommand, runPromptCommand } from '../src/commands.js'
import { PromptLibrary } from '../src/library.js'
import { PROMPT_USAGE } from '../src/parse.js'
import { UsageStats } from '../src/usage.js'
import { followupRecorder, invocation } from './support/invocation.js'
import { MemoryUsage } from './support/usage-memory.js'
import { MemoryVault } from './support/vault-memory.js'

function library() {
  return new PromptLibrary(new MemoryVault(), { maxNameLength: 64, maxBodyChars: 100, maxCount: 10, versionHistory: 20 })
}

describe('buildPromptCommand', () => {
  test('注册为 p 命令并带输入提示', () => {
    const definition = buildPromptCommand(library())
    expect(definition.name).toBe('p')
    expect(definition.description).not.toBe('')
    expect(definition.input?.hint).toContain('add <name> <body>')
  })
})

describe('runPromptCommand', () => {
  test('空库列出空提示', async () => {
    const result = await runPromptCommand(library(), { rawInput: '', send: () => {} })
    expect(result).toEqual({ kind: 'success', text: 'no prompts yet. add one with /p add <name> <body>' })
  })

  test('非空库一行一条，有说明才带说明', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '上线步骤', body: '正文' })
    await lib.add({ name: 'ci', description: '', body: '正文' })
    const result = await runPromptCommand(lib, { rawInput: ' list ', send: () => {} })
    expect(result).toEqual({ kind: 'success', text: 'ci\ndeploy — 上线步骤' })
  })

  test('show 命中原样返回正文', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '第一步\n第二步' })
    const result = await runPromptCommand(lib, { rawInput: ' show deploy ', send: () => {} })
    expect(result).toEqual({ kind: 'success', text: '第一步\n第二步' })
  })

  test('show 落空明确报错', async () => {
    const result = await runPromptCommand(library(), { rawInput: ' show ghost ', send: () => {} })
    expect(result).toEqual({ kind: 'error', text: 'prompt "ghost" does not exist' })
  })

  test('add 成功给确认', async () => {
    const lib = library()
    const result = await runPromptCommand(lib, { rawInput: ' add deploy 上线步骤 ', send: () => {} })
    expect(result).toEqual({ kind: 'success', text: 'saved "deploy"' })
    expect(await lib.get('deploy')).toEqual({ name: 'deploy', description: '', body: '上线步骤' })
  })

  test('add 重名把库的错原文返回', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '旧' })
    const result = await runPromptCommand(lib, { rawInput: ' add deploy 新 ', send: () => {} })
    expect(result).toEqual({ kind: 'error', text: 'prompt "deploy" already exists' })
  })

  test('rm 删掉给确认，删空给不存在', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    expect(await runPromptCommand(lib, { rawInput: ' rm deploy ', send: () => {} }))
      .toEqual({ kind: 'success', text: 'removed "deploy"' })
    expect(await runPromptCommand(lib, { rawInput: ' rm deploy ', send: () => {} }))
      .toEqual({ kind: 'error', text: 'prompt "deploy" does not exist' })
  })

  test('rename 成功给确认，失败原文返回', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    expect(await runPromptCommand(lib, { rawInput: ' rename deploy release ', send: () => {} }))
      .toEqual({ kind: 'success', text: 'renamed "deploy" to "release"' })
    expect(await runPromptCommand(lib, { rawInput: ' rename ghost x ', send: () => {} }))
      .toEqual({ kind: 'error', text: 'prompt "ghost" does not exist' })
  })

  test('非法输入直接当错误结果', async () => {
    const result = await runPromptCommand(library(), { rawInput: ' bogus ', send: () => {} })
    expect(result.kind).toBe('error')
    expect(result).toEqual({ kind: 'error', text: PROMPT_USAGE })
  })

  test('send 把正文交给发送回调并给确认', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '上线正文' })
    let sent: string | undefined
    const result = await runPromptCommand(lib, { rawInput: ' send deploy ', send: (body) => { sent = body } })
    expect(sent).toBe('上线正文')
    expect(result).toEqual({ kind: 'success', text: 'sent "deploy"' })
  })

  test('send 落空不发送并报错', async () => {
    let called = false
    const result = await runPromptCommand(library(), { rawInput: ' send ghost ', send: () => { called = true } })
    expect(called).toBe(false)
    expect(result).toEqual({ kind: 'error', text: 'prompt "ghost" does not exist' })
  })

  test('send 有变量按赋值渲染后发送', async () => {
    const lib = library()
    await lib.add({ name: 'review', description: '', body: '看 {{pr}} 的 {{focus}}' })
    let sent: string | undefined
    const result = await runPromptCommand(lib, { rawInput: ' send review pr=12 focus=安全 ', send: (body) => { sent = body } })
    expect(sent).toBe('看 12 的 安全')
    expect(result).toEqual({ kind: 'success', text: 'sent "review"' })
  })

  test('send 缺变量点名并给补全格式', async () => {
    const lib = library()
    await lib.add({ name: 'review', description: '', body: '看 {{pr}} 的 {{focus}}' })
    let called = false
    const result = await runPromptCommand(lib, { rawInput: ' send review pr=12 ', send: () => { called = true } })
    expect(called).toBe(false)
    expect(result).toEqual({ kind: 'error', text: 'missing variables for "review": focus. usage: /p send review focus=...' })
  })

  test('send 未知键算拼写错，无变量还硬给也算错', async () => {
    const lib = library()
    await lib.add({ name: 'review', description: '', body: '看 {{pr}}' })
    await lib.add({ name: 'plain', description: '', body: '纯文本' })
    expect(await runPromptCommand(lib, { rawInput: ' send review pr=1 fcous=x ', send: () => {} }))
      .toEqual({ kind: 'error', text: 'unknown variables for "review": fcous' })
    expect(await runPromptCommand(lib, { rawInput: ' send plain k=v ', send: () => {} }))
      .toEqual({ kind: 'error', text: 'prompt "plain" takes no variables, got: k' })
  })

  test('send 成功记一次使用', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    const vault = new MemoryUsage()
    const usage = new UsageStats(vault, () => 1000)
    const result = await runPromptCommand(lib, { rawInput: ' send deploy ', send: () => {}, usage })
    expect(result).toEqual({ kind: 'success', text: 'sent "deploy"' })
    expect(await usage.get('deploy')).toEqual({ name: 'deploy', count: 1, lastUsedAt: 1000 })
  })

  test('统计记失败不翻转成功发送', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    const broken = new UsageStats({
      get: () => Promise.resolve(undefined),
      put: () => Promise.reject(new Error('disk gone')),
      delete: () => Promise.resolve(false),
      all: () => Promise.resolve([]),
    }, () => 0)
    let sent = false
    const result = await runPromptCommand(lib, { rawInput: ' send deploy ', send: () => { sent = true }, usage: broken })
    expect(sent).toBe(true)
    expect(result).toEqual({ kind: 'success', text: 'sent "deploy"' })
  })

  test('命令入口把 send 接到 agent.followup，消息内容为正文', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '上线正文' })
    const recorder = followupRecorder()
    const result = await buildPromptCommand(lib).handler(invocation(' send deploy ', recorder.agent))
    expect(result).toEqual({ kind: 'success', text: 'sent "deploy"' })
    expect(recorder.messages).toHaveLength(1)
    expect(recorder.messages[0]?.content).toEqual([{ type: 'text', text: '上线正文' }])
  })
})
