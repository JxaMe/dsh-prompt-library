import type { SessionId } from '@deepseek-ai/dsh-session/types'

/** 会话输入面：读草稿、写草稿（对齐会话服务的输入面结构）。 */
export interface DraftInput {
  readonly state: { getSnapshot(): { draft: string } }
  setDraft(text: string): void
}

/** appendToDraft 的协作面：取会话作用域与会话输入。 */
export interface DraftDeps {
  readonly sessions: { scope(id: SessionId): unknown } | undefined
  readonly conversation: { input: { for(sessionScope: unknown): DraftInput } } | undefined
}

/**
 * 草稿合并：空草稿直接放，非空空格拼接（与 @引用同一写法）。
 * @param current - 当前草稿。
 * @param text - 要插入的正文。
 * @returns 合并后的草稿。
 */
export function insertToDraft(current: string, text: string): string {
  return current.trim() === '' ? text : `${current} ${text}`
}

/**
 * 把正文追加进会话的输入框草稿（只填草稿，不发送）。
 * 服务或作用域缺失返回假，面板负责报错，绝不抛。
 * @param deps - 会话与会话输入协作面。
 * @param sessionId - 会话 id。
 * @param text - 要插入的正文。
 * @returns 是否写进去了。
 */
export function appendToDraft(deps: DraftDeps, sessionId: SessionId, text: string): boolean {
  try {
    const sessionScope = deps.sessions?.scope(sessionId)
    if (sessionScope === undefined) return false
    const input = deps.conversation?.input.for(sessionScope)
    if (input === undefined) return false
    input.setDraft(insertToDraft(input.state.getSnapshot().draft, text))
    return true
  } catch {
    return false
  }
}
