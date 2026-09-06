/** 目录行：名称、说明与使用统计（没用过就是 0/null）。 */
export interface PromptSummary {
  readonly name: string
  readonly description: string
  readonly useCount: number
  readonly lastUsedAt: number | null
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
    const row = item as { name?: unknown; description?: unknown; useCount?: unknown; lastUsedAt?: unknown }
    return typeof row.name === 'string'
      && typeof row.description === 'string'
      && typeof row.useCount === 'number'
      && (row.lastUsedAt === null || typeof row.lastUsedAt === 'number')
  })
}

/**
 * 常用优先排序：用过按最后使用倒序，没用过按名称排最后。不改原数组。
 * @param rows - 目录行。
 * @returns 新的排序数组。
 */
export function sortSummaries(rows: readonly PromptSummary[]): PromptSummary[] {
  return [...rows].sort((a, b) => {
    if (a.lastUsedAt === null && b.lastUsedAt === null) return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
    if (a.lastUsedAt === null) return 1
    if (b.lastUsedAt === null) return -1
    if (a.lastUsedAt !== b.lastUsedAt) return b.lastUsedAt - a.lastUsedAt
    return a.name < b.name ? -1 : a.name > b.name ? 1 : 0
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

/**
 * 改内容。description/body 给哪个换哪个。
 * @param fetchImpl - 请求实现。
 * @param name - 提示词名称。
 * @param patch - 要换的字段。
 */
export async function updatePrompt(
  fetchImpl: FetchImpl,
  name: string,
  patch: { description?: string; body?: string },
): Promise<void> {
  await postJson(fetchImpl, '/prompt-library/api/prompts/update', { name, ...patch })
}

/** 单条全文：编辑页打开时按需取。 */
export interface PromptDetail extends PromptSummary {
  readonly body: string
}

/**
 * 组装 /p send 命令行。值含空白自动加双引号；值含双引号直接拒绝
 * （send 解析 v1 无转义，拼不出来的行不拼）。
 * @param name - 提示词名称。
 * @param values - 变量赋值。
 * @returns 完整命令行。
 */
export function buildSendLine(name: string, values: Readonly<Record<string, string>>): string {
  const parts = Object.entries(values).map(([key, value]) => {
    if (value.includes('"')) throw new Error(`value of "${key}" must not contain double quotes`)
    return /\s/.test(value) ? `${key}="${value}"` : `${key}=${value}`
  })
  return [`/p send ${name}`, ...parts].join(' ')
}

function isPromptDetail(data: unknown): data is PromptDetail {
  if (typeof data !== 'object' || data === null) return false
  const row = data as { name?: unknown; description?: unknown; body?: unknown }
  return typeof row.name === 'string' && typeof row.description === 'string' && typeof row.body === 'string'
}

/**
 * 取单条全文。
 * @param fetchImpl - 请求实现。
 * @param name - 提示词名称。
 * @returns 名称、说明与正文。
 */
export async function getPromptDetail(fetchImpl: FetchImpl, name: string): Promise<PromptDetail> {
  const response = await fetchImpl(`/prompt-library/api/prompts/${encodeURIComponent(name)}`)
  if (!response.ok) {
    const data = (await response.json()) as unknown
    throw new Error(serverMessage(data) ?? `prompt detail request failed: ${response.status}`)
  }
  const data = (await response.json()) as unknown
  if (!isPromptDetail(data)) throw new Error('prompt detail has an unexpected shape')
  return data
}
