import { mkdtemp, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, test } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import type { Agent } from '@deepseek-ai/dsh-agent'
import CommandRuntime from '@deepseek-ai/dsh-commands'
import { createScope } from '@deepseek-ai/dsh-scope'
import SessionStore, { SessionId } from '@deepseek-ai/dsh-session'
import Storage from '@deepseek-ai/dsh-storage'
import * as storageJson from '@deepseek-ai/dsh-storage-json'
import * as storageDomain from '@deepseek-ai/dsh-storage-domain'
import * as promptManager from '../src/index.js'

const roots: string[] = []

afterEach(async () => {
  while (roots.length > 0) {
    const root = roots.pop()
    if (root !== undefined) await rm(root, { recursive: true, force: true })
  }
})

/** 真栈：hub + json 文件后端 + 域插件 + 会话 + 命令表 + 本插件。不替任何一层。 */
async function boot(root: string, pluginConfig: Record<string, unknown> = {}) {
  const ctx = new Context()
  const fibers = [
    await ctx.plugin(Storage),
    await ctx.plugin(storageJson, { root }),
    await ctx.plugin(storageDomain, { backend: 'json' }),
    await ctx.plugin(SessionStore),
    await ctx.plugin(CommandRuntime),
    await ctx.plugin(promptManager, pluginConfig),
  ]
  const session = ctx.sessions.create(SessionId('s1'))
  const agent = { id: session.id, session } as Agent
  await ctx.plugin(Object.assign((inner: Context) => { createScope(inner, agent) }, { inject: ['commands'] }))
  const execute = (line: string) => ctx.commands.execute(agent, line, [], new AbortController().signal)
  const dispose = async () => { for (const fiber of fibers.reverse()) await fiber.dispose() }
  return { ctx, execute, dispose }
}

describe('composition', () => {
  test('真执行 /p 增查，文件落盘，重启可读回', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-prompt-'))
    roots.push(root)
    const first = await boot(root)
    expect((await first.execute('/p add deploy 上线正文'))?.result)
      .toEqual({ kind: 'success', text: 'saved "deploy"' })
    expect((await first.execute('/p list'))?.result)
      .toEqual({ kind: 'success', text: 'deploy' })
    expect(await readdir(root)).toContain('prompt_library.json')
    await first.dispose()

    const second = await boot(root)
    expect((await second.execute('/p show deploy'))?.result)
      .toEqual({ kind: 'success', text: '上线正文' })
    await second.dispose()
  })

  test('非法配置挂载即失败', async () => {
    const root = await mkdtemp(join(tmpdir(), 'dsh-prompt-'))
    roots.push(root)
    await expect(boot(root, { maxCount: 0 })).rejects.toThrow()
  })
})
