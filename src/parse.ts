/** /p 子命令解析结果。closed union：加分支必须同步加测试。 */
export type PromptCommand =
  | { readonly kind: 'list' }
  | { readonly kind: 'show'; readonly name: string }
  | { readonly kind: 'send'; readonly name: string }
  | { readonly kind: 'add'; readonly name: string; readonly body: string }
  | { readonly kind: 'rm'; readonly name: string }
  | { readonly kind: 'rename'; readonly from: string; readonly to: string }
  | { readonly kind: 'invalid'; readonly reason: string }

/** 所有子命令的用法总览：未知输入的 reason，也是 /p 的输入提示。 */
export const PROMPT_USAGE = 'usage: /p list | show <name> | send <name> | add <name> <body> | rm <name> | rename <old> <new>'

/**
 * 解析 /p 命令名之后的参数。
 * @param rawInput - 命令名后的原文（含分隔空白）。
 * @returns 解析出的子命令。
 */
export function parsePromptArgs(rawInput: string): PromptCommand {
  const words = rawInput.trim().split(/\s+/)
  const head = words[0]
  if (head === undefined || head === '') return { kind: 'list' }
  if (head === 'list') return { kind: 'list' }
  if (head === 'show') {
    const name = words[1]
    if (name !== undefined && words.length === 2) return { kind: 'show', name }
    return { kind: 'invalid', reason: 'usage: /p show <name>' }
  }
  if (head === 'send') {
    const name = words[1]
    if (name !== undefined && words.length === 2) return { kind: 'send', name }
    return { kind: 'invalid', reason: 'usage: /p send <name>' }
  }
  if (head === 'add') {
    const afterHead = rawInput.trim().slice(head.length).trim()
    const gap = afterHead.search(/\s/)
    if (gap === -1) return { kind: 'invalid', reason: 'usage: /p add <name> <body>' }
    const body = afterHead.slice(gap).trim()
    if (body === '') return { kind: 'invalid', reason: 'usage: /p add <name> <body>' }
    return { kind: 'add', name: afterHead.slice(0, gap), body }
  }
  if (head === 'rm') {
    const name = words[1]
    if (name !== undefined && words.length === 2) return { kind: 'rm', name }
    return { kind: 'invalid', reason: 'usage: /p rm <name>' }
  }
  if (head === 'rename') {
    const from = words[1]
    const to = words[2]
    if (from !== undefined && to !== undefined && words.length === 3) return { kind: 'rename', from, to }
    return { kind: 'invalid', reason: 'usage: /p rename <old> <new>' }
  }
  return { kind: 'invalid', reason: PROMPT_USAGE }
}
