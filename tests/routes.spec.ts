import { describe, expect, test } from 'vitest'
import { Readable } from 'node:stream'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { PromptLibrary } from '../src/library.js'
import {
  answerPromptAdd,
  answerPromptItem,
  answerPromptList,
  answerPromptRemove,
  answerPromptRename,
  answerPromptUpdate,
  isTrustedRequest,
  readJsonBody,
  registerPromptRoutes,
  routePromptRequest,
} from '../src/routes.js'
import { MemoryUsage } from './support/usage-memory.js'
import { MemoryVault } from './support/vault-memory.js'
import { UsageStats } from '../src/usage.js'

function library() {
  return new PromptLibrary(new MemoryVault(), { maxNameLength: 64, maxBodyChars: 100, maxCount: 10 })
}

describe('answerPromptList', () => {
  test('空库返回空数组', async () => {
    expect(await answerPromptList(library())).toEqual({ status: 200, body: { prompts: [] } })
  })

  test('只给名称和说明，不给正文；无统计就是 0/null', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '上线步骤', body: '秘密正文' })
    expect(await answerPromptList(lib)).toEqual({
      status: 200,
      body: { prompts: [{ name: 'deploy', description: '上线步骤', useCount: 0, lastUsedAt: null }] },
    })
  })

  test('有统计带上次数与时间', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    const usage = new UsageStats(new MemoryUsage(), () => 1000)
    await usage.recordUse('deploy')
    await usage.recordUse('deploy')
    expect(await answerPromptList(lib, usage)).toEqual({
      status: 200,
      body: { prompts: [{ name: 'deploy', description: '', useCount: 2, lastUsedAt: 1000 }] },
    })
  })
})

describe('answerPromptAdd', () => {
  test('成功返回名称', async () => {
    const lib = library()
    expect(await answerPromptAdd(lib, { name: 'deploy', description: '说明', body: '正文' }))
      .toEqual({ status: 200, body: { name: 'deploy' } })
    expect(await lib.get('deploy')).toEqual({ name: 'deploy', description: '说明', body: '正文' })
  })

  test('形态垃圾直接 400，进不了库', async () => {
    const lib = library()
    for (const bad of [null, 'str', 42, {}, { name: 1, body: 'x' }, { name: 'a' }]) {
      expect(await answerPromptAdd(lib, bad)).toEqual({ status: 400, body: { error: 'invalid prompt payload' } })
    }
    expect(await lib.list()).toEqual([])
  })

  test('库的拒绝原文返回 400', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '旧' })
    expect(await answerPromptAdd(lib, { name: 'deploy', body: '新' }))
      .toEqual({ status: 400, body: { error: 'prompt "deploy" already exists' } })
    expect(await answerPromptAdd(lib, { name: 'Bad Name', body: 'x' }))
      .toEqual({ status: 400, body: { error: 'invalid prompt name "Bad Name": use lowercase letters, digits, dash and underscore' } })
  })
})

describe('answerPromptRemove', () => {
  test('删掉返回真，删空 404，形态垃圾 400', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    expect(await answerPromptRemove(lib, { name: 'deploy' })).toEqual({ status: 200, body: { removed: true } })
    expect(await answerPromptRemove(lib, { name: 'deploy' })).toEqual({ status: 404, body: { error: 'prompt "deploy" does not exist' } })
    expect(await answerPromptRemove(lib, { name: 1 })).toEqual({ status: 400, body: { error: 'invalid remove payload' } })
    expect(await answerPromptRemove(lib, null)).toEqual({ status: 400, body: { error: 'invalid remove payload' } })
  })
})

describe('answerPromptRename', () => {
  test('成功返回新名', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    expect(await answerPromptRename(lib, { from: 'deploy', to: 'release' }))
      .toEqual({ status: 200, body: { name: 'release' } })
    expect(await lib.get('release')).toEqual({ name: 'release', description: '', body: '正文' })
  })

  test('旧名不在 404，新名被占与形态垃圾 400', async () => {
    const lib = library()
    await lib.add({ name: 'b', description: '', body: '乙' })
    expect(await answerPromptRename(lib, { from: 'a', to: 'c' }))
      .toEqual({ status: 404, body: { error: 'prompt "a" does not exist' } })
    expect(await answerPromptRename(lib, { from: 'b', to: 'b' }))
      .toEqual({ status: 400, body: { error: 'prompt "b" already exists' } })
    expect(await answerPromptRename(lib, { from: 'b' }))
      .toEqual({ status: 400, body: { error: 'invalid rename payload' } })
    expect(await answerPromptRename(lib, null))
      .toEqual({ status: 400, body: { error: 'invalid rename payload' } })
  })
})

describe('routePromptRequest', () => {
  test('目录路径分发到列表', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/prompts' }))
      .toEqual({ status: 200, body: { prompts: [{ name: 'deploy', description: '', useCount: 0, lastUsedAt: null }] } })
  })

  test('单条子路径按名称查，写路径名也可作名称', async () => {
    const lib = library()
    expect(await routePromptRequest(lib, { method: 'POST', pathname: '/prompt-library/api/prompts' }))
      .toEqual({ status: 405, body: { error: 'method not allowed' } })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/other' }))
      .toEqual({ status: 404, body: { error: 'not found' } })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/prompts/deploy' }))
      .toEqual({ status: 404, body: { error: 'prompt "deploy" does not exist' } })
    expect(await routePromptRequest(lib, { method: 'PUT', pathname: '/prompt-library/api/prompts/add' }))
      .toEqual({ status: 405, body: { error: 'method not allowed' } })
  })

  test('POST 写路径分发到对应应答', async () => {
    const lib = library()
    expect(await routePromptRequest(lib, { method: 'POST', pathname: '/prompt-library/api/prompts/add', body: { name: 'a', body: '甲' } }))
      .toEqual({ status: 200, body: { name: 'a' } })
    expect(await routePromptRequest(lib, { method: 'POST', pathname: '/prompt-library/api/prompts/rename', body: { from: 'a', to: 'b' } }))
      .toEqual({ status: 200, body: { name: 'b' } })
    expect(await routePromptRequest(lib, { method: 'POST', pathname: '/prompt-library/api/prompts/remove', body: { name: 'b' } }))
      .toEqual({ status: 200, body: { removed: true } })
  })

  test('POST 改内容路径分发', async () => {
    const lib = library()
    await lib.add({ name: 'a', description: '', body: '甲' })
    expect(await routePromptRequest(lib, { method: 'POST', pathname: '/prompt-library/api/prompts/update', body: { name: 'a', body: '乙' } }))
      .toEqual({ status: 200, body: { name: 'a' } })
    expect(await lib.get('a')).toEqual({ name: 'a', description: '', body: '乙' })
  })

  test('GET 单条路径分发到全文', async () => {
    const lib = library()
    await lib.add({ name: 'a', description: '说明', body: '甲' })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/prompts/a' }))
      .toEqual({ status: 200, body: { name: 'a', description: '说明', body: '甲' } })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/prompts/ghost' }))
      .toEqual({ status: 404, body: { error: 'prompt "ghost" does not exist' } })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/prompts/%E0%A4%A' }))
      .toEqual({ status: 400, body: { error: 'bad prompt name encoding' } })
  })
})

describe('answerPromptUpdate', () => {
  test('形态垃圾 400，一个字段不给也算垃圾', async () => {
    const lib = library()
    await lib.add({ name: 'a', description: '', body: '甲' })
    expect(await answerPromptUpdate(lib, { name: 'a', body: 1 }))
      .toEqual({ status: 400, body: { error: 'invalid update payload' } })
    expect(await answerPromptUpdate(lib, { name: 'a' }))
      .toEqual({ status: 400, body: { error: 'invalid update payload' } })
    expect(await answerPromptUpdate(lib, null))
      .toEqual({ status: 400, body: { error: 'invalid update payload' } })
    expect(await lib.get('a')).toEqual({ name: 'a', description: '', body: '甲' })
  })

  test('旧名不在 404', async () => {
    expect(await answerPromptUpdate(library(), { name: 'ghost', body: 'x' }))
      .toEqual({ status: 404, body: { error: 'prompt "ghost" does not exist' } })
  })
})

describe('readJsonBody', () => {
  test('正常解析 JSON', async () => {
    const req = Readable.from(['{"name":"a",', '"body":"甲"}']) as IncomingMessage
    expect(await readJsonBody(req)).toEqual({ name: 'a', body: '甲' })
  })

  test('空体返回 undefined', async () => {
    const req = Readable.from([]) as IncomingMessage
    expect(await readJsonBody(req)).toBeUndefined()
  })

  test('坏 JSON 与超限抛错', async () => {
    const bad = Readable.from(['{oops']) as IncomingMessage
    await expect(readJsonBody(bad)).rejects.toThrow('invalid json body')
    const big = Readable.from(['x'.repeat(300 * 1024)]) as IncomingMessage
    await expect(readJsonBody(big)).rejects.toThrow('body too large')
  })
})

describe('isTrustedRequest', () => {
  test('回环地址直接放行', () => {
    expect(isTrustedRequest('127.0.0.1:3080', [])).toBe(true)
    expect(isTrustedRequest('localhost', [])).toBe(true)
    expect(isTrustedRequest('[::1]:3080', [])).toBe(true)
  })

  test('受信列表按主机名或完整 authority 匹配', () => {
    expect(isTrustedRequest('192.168.1.2:3080', ['192.168.1.2'])).toBe(true)
    expect(isTrustedRequest('192.168.1.2:3080', ['192.168.1.2:3080'])).toBe(true)
    expect(isTrustedRequest('192.168.1.2:3080', ['10.0.0.1'])).toBe(false)
  })

  test('缺头与外域一律拒绝', () => {
    expect(isTrustedRequest(undefined, [])).toBe(false)
    expect(isTrustedRequest('', [])).toBe(false)
    expect(isTrustedRequest('evil.example', [])).toBe(false)
  })
})

/** 桩 webServer：记下注册的路由，可手动触发 handler。 */
function stubServer() {
  const routes: WebRoute[] = []
  return {
    routes,
    server: {
      register: (route: WebRoute): (() => void) => {
        routes.push(route)
        return () => { routes.splice(routes.indexOf(route), 1) }
      },
    },
  }
}

function request(method: string, url: string, host: string | undefined, body = ''): IncomingMessage {
  const req = Readable.from(body === '' ? [] : [body]) as unknown as Record<string, unknown>
  req.method = method
  req.url = url
  req.headers = { host }
  return req as unknown as IncomingMessage
}

function response() {
  const chunks: string[] = []
  let status = 0
  const res = {
    writeHead: (code: number): void => { status = code },
    end: (body: string): void => { chunks.push(body) },
  } as unknown as ServerResponse
  return { res, status: () => status, json: () => JSON.parse(chunks.join('')) as unknown }
}

describe('registerPromptRoutes', () => {
  test('注册一次 prefix 路由，注销即移除', async () => {
    const { routes, server } = stubServer()
    const dispose = registerPromptRoutes(server, () => [], library())
    expect(routes).toHaveLength(1)
    expect(routes[0]?.kind).toBe('prefix')
    expect(routes[0]?.path).toBe('/prompt-library/api')
    dispose()
    expect(routes).toHaveLength(0)
  })

  test('GET 目录走完全链并回 JSON', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    const { routes, server } = stubServer()
    registerPromptRoutes(server, () => [], lib)
    const { res, status, json } = response()
    await routes[0]?.handler(request('GET', '/prompt-library/api/prompts', '127.0.0.1:3080'), res)
    expect(status()).toBe(200)
    expect(json()).toEqual({ prompts: [{ name: 'deploy', description: '', useCount: 0, lastUsedAt: null }] })
  })

  test('目录行带统计穿过整链', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    const usage = new UsageStats(new MemoryUsage(), () => 1000)
    await usage.recordUse('deploy')
    const { routes, server } = stubServer()
    registerPromptRoutes(server, () => [], lib, usage)
    const { res, status, json } = response()
    await routes[0]?.handler(request('GET', '/prompt-library/api/prompts', '127.0.0.1'), res)
    expect(status()).toBe(200)
    expect(json()).toEqual({ prompts: [{ name: 'deploy', description: '', useCount: 1, lastUsedAt: 1000 }] })
  })

  test('不信任的请求到不了库', async () => {
    const broken = new PromptLibrary(
      {
        get: () => Promise.reject(new Error('must not reach')),
        put: () => Promise.reject(new Error('must not reach')),
        delete: () => Promise.reject(new Error('must not reach')),
        all: () => Promise.reject(new Error('must not reach')),
      },
      { maxNameLength: 64, maxBodyChars: 100, maxCount: 10 },
    )
    const { routes, server } = stubServer()
    registerPromptRoutes(server, () => [], broken)
    const { res, status, json } = response()
    await routes[0]?.handler(request('GET', '/prompt-library/api/prompts', 'evil.example'), res)
    expect(status()).toBe(403)
    expect(json()).toEqual({ error: 'forbidden' })
  })

  test('POST 回 405 JSON', async () => {
    const { routes, server } = stubServer()
    registerPromptRoutes(server, () => [], library())
    const { res, status, json } = response()
    await routes[0]?.handler(request('POST', '/prompt-library/api/prompts', '127.0.0.1'), res)
    expect(status()).toBe(405)
    expect(json()).toEqual({ error: 'method not allowed' })
  })
})
