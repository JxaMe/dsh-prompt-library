/** 变量名规则：字母数字下划线（与提示词名不同的字符集，模板内自足）。 */
export const VARIABLE_RE = /\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g

/**
 * 提取正文中的变量名，去重并保首次出现序。
 * 未闭合与非法名不是变量，原样留在正文里。
 * @param body - 提示词正文。
 * @returns 变量名数组。
 */
export function extractVariables(body: string): string[] {
  const seen = new Set<string>()
  for (const match of body.matchAll(VARIABLE_RE)) {
    const name = match[1]
    if (name !== undefined) seen.add(name)
  }
  return [...seen]
}

/** 渲染结果：成功带文本，失败带缺的变量名（保序）。 */
export type RenderResult =
  | { readonly ok: true; readonly text: string }
  | { readonly ok: false; readonly missing: readonly string[] }

/**
 * 渲染模板。多给的值忽略（调用方负责拼写检查）；缺的全部报出，不断行。
 * @param body - 提示词正文。
 * @param values - 变量名到值的映射。
 * @returns 渲染结果。
 */
export function renderTemplate(body: string, values: Readonly<Record<string, string>>): RenderResult {
  const missing = extractVariables(body).filter((name) => !(name in values))
  if (missing.length > 0) return { ok: false, missing }
  const text = body.replace(VARIABLE_RE, (match: string, name: unknown) => {
    if (typeof name !== 'string') return match
    const value = values[name]
    return value === undefined ? match : value
  })
  return { ok: true, text }
}
