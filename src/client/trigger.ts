import type { InputTriggerSource } from '@deepseek-ai/dsh-client-ui-input-trigger/client'
import { getPromptDetail, listPrompts, sortSummaries } from './prompts.js'
import type { FetchImpl, PromptSummary } from './prompts.js'

/** 空查询时每组最多展示行数（有查询不过滤数量，越细越少）。 */
const BARE_QUERY_LIMIT = 20

/** 候选 value 载荷：onPick 同步取用，无需二次请求。 */
interface PromptPickValue {
  readonly v: 1
  readonly body: string
}

function encodeValue(body: string): string {
  return JSON.stringify({ v: 1, body })
}

function decodeBody(value: string | undefined): string | undefined {
  if (value === undefined) return undefined
  try {
    const data = JSON.parse(value) as { v?: unknown; body?: unknown }
    if (data.v !== 1 || typeof data.body !== 'string') return undefined
    return data.body
  } catch {
    return undefined
  }
}

function matches(row: PromptSummary, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  return row.name.toLowerCase().includes(q) || row.description.toLowerCase().includes(q)
}

function firstLine(text: string, maxChars: number): string {
  const line = text.split('\n', 1)[0] ?? ''
  return line.length <= maxChars ? line : `${line.slice(0, maxChars)}…`
}

/**
 * `@` 提示词源：与文件引用走同一菜单，选中即把正文填进输入框（粘贴语义，
 * 发出前可见可改）。正文随候选一起带（载荷上限看库的上限；空查询封顶 20 行）。
 * @param fetchImpl - 请求实现，默认全局 fetch。
 * @returns 输入触发源。
 */
export function promptTriggerSource(fetchImpl: FetchImpl = globalThis.fetch): InputTriggerSource {
  return {
    trigger: '@',
    name: 'prompts',
    async candidates(_session, { query, signal }) {
      const summaries = await listPrompts(fetchImpl, { signal })
      const matched = sortSummaries(summaries.filter((row) => matches(row, query)))
      const capped = query.trim() === '' ? matched.slice(0, BARE_QUERY_LIMIT) : matched
      const details = await Promise.all(capped.map((row) => getPromptDetail(fetchImpl, row.name, { signal })))
      if (signal.aborted) return []
      return details.map((detail) => ({
        name: detail.name,
        description: detail.description === '' ? firstLine(detail.body, 60) : detail.description,
        value: encodeValue(detail.body),
      }))
    },
    onPick({ candidate }) {
      const body = decodeBody(candidate.value)
      if (body === undefined) return undefined
      return { text: body }
    },
  }
}
