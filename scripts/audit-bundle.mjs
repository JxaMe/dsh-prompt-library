/**
 * 发布前 bundle 审计：lazy-CJS factory 契约 + 外部依赖白名单。
 * 用法：npm run audit:bundle（build 之后跑）。
 * 白名单只有 react 系（宿主模块表基线行）；其他运行时 require
 * （如漏内联的 dependencies）会让 factory 在浏览器里直接抛。
 */
import { readFileSync } from 'node:fs'

const ALLOWED_EXTERNALS = new Set(['react', 'react/jsx-runtime'])
const BUNDLE_ID = 'dsh-prompt-library'

const src = readFileSync(new URL('../lib/client.js', import.meta.url), 'utf8')
const compact = src.replace(/\/\/# sourceMappingURL=.*$/, '').replace(/\s+/g, ' ').trimEnd()
const failures = []

if (!src.includes(`id: "${BUNDLE_ID}"`)) failures.push('banner 缺少正确的 bundle id')
if (!src.includes('factory: (require) => {')) failures.push('banner 缺少 factory 注册')
if (!compact.endsWith('return module.exports; } });')) failures.push('footer 不是 return module.exports 闭包')
const externals = [...src.matchAll(/require\("([^"]+)"\)/g)].map((m) => m[1])
for (const spec of new Set(externals)) {
  if (!ALLOWED_EXTERNALS.has(spec)) failures.push(`非法外部依赖: ${spec}`)
}
if (!src.includes('/p send')) failures.push('业务代码疑似被 tree-shake 掉')

if (failures.length > 0) {
  console.error(`bundle audit failed:\n- ${failures.join('\n- ')}`)
  process.exit(1)
}
console.log(`bundle audit ok: externals=[${[...new Set(externals)].join(', ')}] size=${src.length}B`)
