/** 目录行：名称与说明。说明可空。 */
export interface PromptSummary {
  readonly name: string
  readonly description: string
}

/** 可注入的 fetch（测试打桩，生产用全局）。只用到 url + init 子集。 */
export type FetchImpl = (url: string, init?: RequestInit) => Promise<Response>

function serverMessage(data: unknown): string | undefined {
  if (typeof data !== 'object' || data === null) return undefined
  const error = (data as { error?: unknown }).error
  return typeof error === 'string' ? error : undefined
}

async function postJson(fetchImpl: FetchImpl, url: string, payload: unknown): Promise<unknown> {
  const response = await fetchImpl(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = (await response.json()) as unknown
  if (!response.ok) throw new Error(serverMessage(data) ?? `prompt request failed: ${response.status} ${url}`)
  return data
}

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

/**
 * 新增一条。description 缺省空串。
 * @param fetchImpl - 请求实现。
 * @param input - 名称、说明与正文。
 * @returns 存下的名称。
 */
export async function addPrompt(
  fetchImpl: FetchImpl,
  input: { name: string; description?: string; body: string },
): Promise<string> {
  const data = await postJson(fetchImpl, '/prompt-library/api/prompts/add', {
    name: input.name,
    description: input.description ?? '',
    body: input.body,
  })
  if (typeof data !== 'object' || data === null || typeof (data as { name?: unknown }).name !== 'string') {
    throw new Error('prompt add has an unexpected shape')
  }
  return (data as { name: string }).name
}

/**
 * 删除一条。不存在服务端报 404，原样抛。
 * @param fetchImpl - 请求实现。
 * @param name - 提示词名称。
 */
export async function removePrompt(fetchImpl: FetchImpl, name: string): Promise<void> {
  await postJson(fetchImpl, '/prompt-library/api/prompts/remove', { name })
}

/**
 * 改名。返回新名。
 * @param fetchImpl - 请求实现。
 * @param from - 旧名称。
 * @param to - 新名称。
 * @returns 新名称。
 */
export async function renamePrompt(fetchImpl: FetchImpl, from: string, to: string): Promise<string> {
  const data = await postJson(fetchImpl, '/prompt-library/api/prompts/rename', { from, to })
  if (typeof data !== 'object' || data === null || typeof (data as { name?: unknown }).name !== 'string') {
    throw new Error('prompt rename has an unexpected shape')
  }
  return (data as { name: string }).name
}
