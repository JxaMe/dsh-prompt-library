import type { IncomingMessage } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { PromptLibraryError } from './errors.js'
import type { PromptLibrary } from './library.js'

/** 应答：状态码与 JSON 体。handler 只负责搬到 res 上，不做业务判断。 */
export interface RouteAnswer {
  readonly status: number
  readonly body: unknown
}

/**
 * 提示词目录：名称与说明的数组，不含正文（列表一次拉全，正文按需再取）。
 * @param library - 提示词库。
 * @returns 200 与目录。
 */
export async function answerPromptList(library: PromptLibrary): Promise<RouteAnswer> {
  const all = await library.list()
  return {
    status: 200,
    body: { prompts: all.map((record) => ({ name: record.name, description: record.description })) },
  }
}

function isAddPayload(data: unknown): data is { name: string; description?: string; body: string } {
  if (typeof data !== 'object' || data === null) return false
  const row = data as { name?: unknown; description?: unknown; body?: unknown }
  if (typeof row.name !== 'string' || typeof row.body !== 'string') return false
  return row.description === undefined || typeof row.description === 'string'
}

/**
 * 新增一条。只验 JSON 形态，领域校验（命名/长度/重名/满额）归库，
 * 库的错原文返回 400。
 * @param library - 提示词库。
 * @param data - 解析过的请求体。
 * @returns 200 或 400。
 */
export async function answerPromptAdd(library: PromptLibrary, data: unknown): Promise<RouteAnswer> {
  if (!isAddPayload(data)) return { status: 400, body: { error: 'invalid prompt payload' } }
  try {
    await library.add({ name: data.name, description: data.description ?? '', body: data.body })
  } catch (error) {
    if (error instanceof PromptLibraryError) return { status: 400, body: { error: error.message } }
    throw error
  }
  return { status: 200, body: { name: data.name } }
}

/**
 * 删除一条。形态错 400；不存在 404。
 * @param library - 提示词库。
 * @param data - 解析过的请求体。
 * @returns 200、400 或 404。
 */
export async function answerPromptRemove(library: PromptLibrary, data: unknown): Promise<RouteAnswer> {
  if (!isRemovePayload(data)) return { status: 400, body: { error: 'invalid remove payload' } }
  const removed = await library.remove(data.name)
  if (!removed) return { status: 404, body: { error: `prompt "${data.name}" does not exist` } }
  return { status: 200, body: { removed: true } }
}

function isRemovePayload(data: unknown): data is { name: string } {
  if (typeof data !== 'object' || data === null) return false
  return typeof (data as { name?: unknown }).name === 'string'
}

function isRenamePayload(data: unknown): data is { from: string; to: string } {
  if (typeof data !== 'object' || data === null) return false
  const row = data as { from?: unknown; to?: unknown }
  return typeof row.from === 'string' && typeof row.to === 'string'
}

/**
 * 改名。形态错 400；旧名不在 404；新名问题原文 400。
 * @param library - 提示词库。
 * @param data - 解析过的请求体。
 * @returns 200、400 或 404。
 */
export async function answerPromptRename(library: PromptLibrary, data: unknown): Promise<RouteAnswer> {
  if (!isRenamePayload(data)) return { status: 400, body: { error: 'invalid rename payload' } }
  try {
    await library.rename(data.from, data.to)
  } catch (error) {
    if (error instanceof PromptLibraryError) {
      const status = error.code === 'missing' ? 404 : 400
      return { status, body: { error: error.message } }
    }
    throw error
  }
  return { status: 200, body: { name: data.to } }
}

/** 路由前缀。handler 挂 prefix，前缀后全部交分发。 */
export const PROMPT_API_PREFIX = '/prompt-library/api'

/** POST 请求体上限 256KB（正文本就 ≤20KB，超了直接拒，内存不爆）。 */
const MAX_JSON_BYTES = 256 * 1024

/**
 * 读完请求体并解析 JSON。空体返回 undefined。
 * @param req - 请求（异步可迭代即可，测试用真 Readable）。
 * @param maxBytes - 上限，超了抛错。
 * @returns 解析值或 undefined（空体）。
 */
export async function readJsonBody(req: IncomingMessage, maxBytes = MAX_JSON_BYTES): Promise<unknown> {
  const chunks: Buffer[] = []
  let size = 0
  for await (const chunk of req) {
    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : (chunk as Buffer)
    size += buf.length
    if (size > maxBytes) throw new Error(`body too large: limit is ${maxBytes} bytes`)
    chunks.push(buf)
  }
  const text = Buffer.concat(chunks).toString('utf8')
  if (text.trim() === '') return undefined
  try {
    return JSON.parse(text) as unknown
  } catch {
    throw new Error('invalid json body')
  }
}

/** 回环主机名：本机浏览器直接放行。 */
const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1'])

/**
 * 浏览器信任判断：Host 头的主机名是回环，或落在受信列表（主机名或完整 authority）。
 * 缺头一律拒绝（fail closed）。
 * @param host - Host 请求头（可带端口）。
 * @param trustedHosts - 服务启动时采样的受信列表。
 * @returns 是否放行。
 */
export function isTrustedRequest(host: string | undefined, trustedHosts: readonly string[]): boolean {
  if (host === undefined || host === '') return false
  let hostname: string
  try {
    hostname = new URL(`http://${host}`).hostname
  } catch {
    return false
  }
  // Node 的 URL.hostname 给 IPv6 保留方括号（[::1]），先剥掉再比。
  if (hostname.startsWith('[') && hostname.endsWith(']')) hostname = hostname.slice(1, -1)
  if (LOOPBACK_HOSTS.has(hostname)) return true
  return trustedHosts.includes(hostname) || trustedHosts.includes(host)
}

/**
 * 纯分发：方法、路径与解析过的请求体进，应答出。
 * 读路径只认 GET 目录；写路径只认 POST；已知路径错方法 405，未知路径 404。
 * @param library - 提示词库。
 * @param request - 大写方法、不带 query 的路径与解析过的请求体（GET 不带）。
 * @returns 应答。
 */
export async function routePromptRequest(
  library: PromptLibrary,
  request: { method: string; pathname: string; body?: unknown },
): Promise<RouteAnswer> {
  const listPath = `${PROMPT_API_PREFIX}/prompts`
  const addPath = `${PROMPT_API_PREFIX}/prompts/add`
  const removePath = `${PROMPT_API_PREFIX}/prompts/remove`
  const renamePath = `${PROMPT_API_PREFIX}/prompts/rename`
  if (request.pathname === listPath) {
    if (request.method !== 'GET') return { status: 405, body: { error: 'method not allowed' } }
    return answerPromptList(library)
  }
  if (request.pathname === addPath || request.pathname === removePath || request.pathname === renamePath) {
    if (request.method !== 'POST') return { status: 405, body: { error: 'method not allowed' } }
    if (request.pathname === addPath) return answerPromptAdd(library, request.body)
    if (request.pathname === removePath) return answerPromptRemove(library, request.body)
    return answerPromptRename(library, request.body)
  }
  return { status: 404, body: { error: 'not found' } }
}

/**
 * registerPromptRoutes 要的 webServer 面：只一个 register，
 * 路由形态即真实 WebRoute（类型对齐，传真服务直接兼容）。
 */
export interface PromptRouteServer {
  register(route: WebRoute): () => void
}

/**
 * 挂载只读路由。围栏先行：不信任的请求到不了分发，更碰不到库。
 * @param webServer - 路由注册面。
 * @param trustedHosts - 每次请求现读的受信列表（跟随服务最新值）。
 * @param library - 提示词库。
 * @returns 注销函数。
 */
export function registerPromptRoutes(
  webServer: PromptRouteServer,
  trustedHosts: () => readonly string[],
  library: PromptLibrary,
): () => void {
  return webServer.register({
    kind: 'prefix',
    path: PROMPT_API_PREFIX,
    handler: async (req, res) => {
      if (!isTrustedRequest(req.headers.host, trustedHosts())) {
        res.writeHead(403, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ error: 'forbidden' }))
        return
      }
      const pathname = new URL(req.url ?? '/', 'http://prompt-library.internal').pathname
      let body: unknown
      if (req.method === 'POST') {
        try {
          body = await readJsonBody(req)
        } catch (error) {
          const message = error instanceof Error ? error.message : 'invalid json body'
          const status = message.startsWith('body too large') ? 413 : 400
          res.writeHead(status, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ error: message }))
          return
        }
      }
      const answer = await routePromptRequest(library, { method: req.method ?? 'GET', pathname, body })
      res.writeHead(answer.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(answer.body))
    },
  })
}
