import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import type { PromptLibrary } from './library.js'

/** 只读应答：状态码与 JSON 体。handler 只负责搬到 res 上，不做业务判断。 */
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

/** 路由前缀。handler 挂 prefix，前缀后全部交分发。 */
export const PROMPT_API_PREFIX = '/prompt-library/api'

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
 * 纯分发：方法与路径进，应答出。只认 GET 的目录路径，其余全部拒绝。
 * @param library - 提示词库。
 * @param request - 大写方法与不带 query 的路径。
 * @returns 应答。
 */
export async function routePromptRequest(
  library: PromptLibrary,
  request: { method: string; pathname: string },
): Promise<RouteAnswer> {
  if (request.method !== 'GET') return { status: 405, body: { error: 'method not allowed' } }
  if (request.pathname === `${PROMPT_API_PREFIX}/prompts`) return answerPromptList(library)
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
      const answer = await routePromptRequest(library, { method: req.method ?? 'GET', pathname })
      res.writeHead(answer.status, { 'content-type': 'application/json' })
      res.end(JSON.stringify(answer.body))
    },
  })
}
