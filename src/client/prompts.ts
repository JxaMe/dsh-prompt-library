/** 目录行：名称与说明。说明可空。 */
export interface PromptSummary {
  readonly name: string
  readonly description: string
}

/** 可注入的 fetch（测试打桩，生产用全局）。 */
export type FetchImpl = (url: string) => Promise<Response>

function isPromptList(data: unknown): data is { prompts: PromptSummary[] } {
  if (typeof data !== 'object' || data === null) return false
  const prompts = (data as { prompts?: unknown }).prompts
  if (!Array.isArray(prompts)) return false
  return prompts.every((item): item is PromptSummary => {
    if (typeof item !== 'object' || item === null) return false
    const row = item as { name?: unknown; description?: unknown }
    return typeof row.name === 'string' && typeof row.description === 'string'
  })
}

/**
 * 拉提示词目录。形态不对直接抛——坏数据不进弹窗。
 * @param fetchImpl - 请求实现，默认全局 fetch。
 * @returns 目录行数组。
 */
export async function listPrompts(fetchImpl: FetchImpl = globalThis.fetch): Promise<readonly PromptSummary[]> {
  const response = await fetchImpl('/prompt-library/api/prompts')
  if (!response.ok) throw new Error(`prompt list request failed: ${response.status}`)
  const data = (await response.json()) as unknown
  if (!isPromptList(data)) throw new Error('prompt list has an unexpected shape')
  return data.prompts
}
