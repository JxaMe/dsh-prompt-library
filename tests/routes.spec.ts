import { describe, expect, test } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
import { PromptLibrary } from '../src/library.js'
import {
  answerPromptList,
  isTrustedRequest,
  registerPromptRoutes,
  routePromptRequest,
} from '../src/routes.js'
import { MemoryVault } from './support/vault-memory.js'

function library() {
  return new PromptLibrary(new MemoryVault(), { maxNameLength: 64, maxBodyChars: 100, maxCount: 10 })
}

describe('answerPromptList', () => {
  test('空库返回空数组', async () => {
    expect(await answerPromptList(library())).toEqual({ status: 200, body: { prompts: [] } })
  })

  test('只给名称和说明，不给正文', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '上线步骤', body: '秘密正文' })
    expect(await answerPromptList(lib)).toEqual({
      status: 200,
      body: { prompts: [{ name: 'deploy', description: '上线步骤' }] },
    })
  })
})

describe('routePromptRequest', () => {
  test('目录路径分发到列表', async () => {
    const lib = library()
    await lib.add({ name: 'deploy', description: '', body: '正文' })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/prompts' }))
      .toEqual({ status: 200, body: { prompts: [{ name: 'deploy', description: '' }] } })
  })

  test('非 GET 拒绝，其他路径 404', async () => {
    const lib = library()
    expect(await routePromptRequest(lib, { method: 'POST', pathname: '/prompt-library/api/prompts' }))
      .toEqual({ status: 405, body: { error: 'method not allowed' } })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/other' }))
      .toEqual({ status: 404, body: { error: 'not found' } })
    expect(await routePromptRequest(lib, { method: 'GET', pathname: '/prompt-library/api/prompts/deploy' }))
      .toEqual({ status: 404, body: { error: 'not found' } })
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

function request(method: string, url: string, host: string | undefined): IncomingMessage {
  return { method, url, headers: { host } } as unknown as IncomingMessage
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
    expect(json()).toEqual({ prompts: [{ name: 'deploy', description: '' }] })
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
