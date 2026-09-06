import type { CommandDefinition, CommandInvocation, CommandResult } from '@deepseek-ai/dsh-commands'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import type { PromptLibrary } from './library.js'
import { PromptLibraryError } from './errors.js'
import { PROMPT_USAGE, parsePromptArgs } from './parse.js'
import { extractVariables, extractVariableSpecs, renderTemplate } from './template.js'
import type { UsageStats } from './usage.js'

/**
 * 成功发送后记一次使用。统计是可丢的派生数据：记失败不翻转成功结果
 * （主效果已发出，为统计报错只会诱使用户重发）。
 */
async function noteUsed(usage: UsageStats | undefined, name: string): Promise<void> {
  if (usage === undefined) return
  try {
    await usage.recordUse(name)
  } catch {
    // 吞掉：recordUse 只碰 vault，能抛出来的只有介质故障；
    // 使用统计是可丢的派生数据，不值得为它翻转已成功的发送。
  }
}

/**
 * 注册给 ctx.commands 的 /p 定义。handler 是薄适配：
 * 解析原文，核心走 runPromptCommand，send 走 agent.followup。
 * @param library - 提示词库。
 * @param usage - 使用统计（可选，不传不记）。
 * @returns 命令定义（注册即 effect，调用方持有 disposer）。
 */
export function buildPromptCommand(library: PromptLibrary, usage?: UsageStats): CommandDefinition {
  return {
    name: 'p',
    description: 'Manage saved prompts: list, show, send, add, remove and rename.',
    input: { hint: PROMPT_USAGE },
    handler: async (invocation: CommandInvocation): Promise<CommandResult> => {
      return runPromptCommand(library, {
        rawInput: invocation.rawInput,
        usage,
        send: (body) => {
          invocation.agent.followup(createUserMessage({
            content: [{ type: 'text', text: body }],
            source: { kind: 'user' },
          }))
        },
      })
    },
  }
}

/**
 * /p 的可测核心：输入原文与发送回调进，结果出。不碰 ctx 与 agent。
 * @param library - 提示词库。
 * @param input - 命令名后的原文，以及 send 分支用的发送回调。
 * @returns 直接渲染的命令结果。
 */
export async function runPromptCommand(
  library: PromptLibrary,
  input: { rawInput: string; send: (body: string) => void; usage?: UsageStats },
): Promise<CommandResult> {
  const command = parsePromptArgs(input.rawInput)
  if (command.kind === 'list') {
    const all = await library.list()
    if (all.length === 0) return { kind: 'success', text: 'no prompts yet. add one with /p add <name> <body>' }
    const lines = all.map((record) => record.description === '' ? record.name : `${record.name} — ${record.description}`)
    return { kind: 'success', text: lines.join('\n') }
  }
  if (command.kind === 'show') {
    const record = await library.get(command.name)
    if (record === undefined) return { kind: 'error', text: `prompt "${command.name}" does not exist` }
    return { kind: 'success', text: record.body }
  }
  if (command.kind === 'add') {
    try {
      await library.add({ name: command.name, description: '', body: command.body })
    } catch (error) {
      if (error instanceof PromptLibraryError) return { kind: 'error', text: error.message }
      throw error
    }
    return { kind: 'success', text: `saved "${command.name}"` }
  }
  if (command.kind === 'rm') {
    const removed = await library.remove(command.name)
    if (!removed) return { kind: 'error', text: `prompt "${command.name}" does not exist` }
    return { kind: 'success', text: `removed "${command.name}"` }
  }
  if (command.kind === 'rename') {
    try {
      await library.rename(command.from, command.to)
    } catch (error) {
      if (error instanceof PromptLibraryError) return { kind: 'error', text: error.message }
      throw error
    }
    return { kind: 'success', text: `renamed "${command.from}" to "${command.to}"` }
  }
  if (command.kind === 'send') {
    const record = await library.get(command.name)
    if (record === undefined) return { kind: 'error', text: `prompt "${command.name}" does not exist` }
    const variables = extractVariables(record.body)
    if (variables.length === 0) {
      const extra = Object.keys(command.values)
      if (extra.length > 0) return { kind: 'error', text: `prompt "${command.name}" takes no variables, got: ${extra.join(', ')}` }
      input.send(record.body)
      await noteUsed(input.usage, command.name)
      return { kind: 'success', text: `sent "${command.name}"` }
    }
    const unknown = Object.keys(command.values).filter((key) => !variables.includes(key))
    if (unknown.length > 0) return { kind: 'error', text: `unknown variables for "${command.name}": ${unknown.join(', ')}` }
    for (const spec of extractVariableSpecs(record.body)) {
      const value = command.values[spec.name]
      if (value !== undefined && spec.options.length > 0 && !spec.options.includes(value)) {
        return { kind: 'error', text: `invalid value for "${spec.name}": "${value}" must be one of: ${spec.options.join(', ')}` }
      }
    }
    const rendered = renderTemplate(record.body, command.values)
    if (!rendered.ok) {
      const hint = rendered.missing.map((name) => `${name}=...`).join(' ')
      return { kind: 'error', text: `missing variables for "${command.name}": ${rendered.missing.join(', ')}. usage: /p send ${command.name} ${hint}` }
    }
    input.send(rendered.text)
    await noteUsed(input.usage, command.name)
    return { kind: 'success', text: `sent "${command.name}"` }
  }
  if (command.kind === 'invalid') return { kind: 'error', text: command.reason }
  const exhaustive: never = command
  throw new Error(`unhandled prompt command: ${JSON.stringify(exhaustive)}`)
}
