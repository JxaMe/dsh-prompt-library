/** 变量占位：`{{name}}` 或 `{{name:opt1|opt2}}`（选项内不许嵌套花括号）。 */
export const VARIABLE_RE = /\{\{\s*([A-Za-z0-9_]+)(?::([^{}]*))?\s*\}\}/g

/**
 * 提取正文中的变量名，去重并保首次出现序。
 * 未闭合与非法名不是变量，原样留在正文里。
 * @param body - 提示词正文。
 * @returns 变量名数组。
 */
export function extractVariables(body: string): string[] {
  return extractVariableSpecs(body).map((spec) => spec.name)
}

/** 变量规格：名称与候选值（空数组即开放填空）。 */
export interface VariableSpec {
  readonly name: string
  readonly options: readonly string[]
}

/**
 * 提取变量规格：`{{fw:react|vue}}` 给出候选，`{{pr}}` 给出空数组；
 * 选项按 `|` 切、去空白、丢空项；重复变量以首次为准。
 * @param body - 提示词正文。
 * @returns 变量规格数组。
 */
export function extractVariableSpecs(body: string): VariableSpec[] {
  const seen = new Map<string, readonly string[]>()
  for (const match of body.matchAll(VARIABLE_RE)) {
    const name = match[1]
    if (name === undefined || seen.has(name)) continue
    const raw = match[2] ?? ''
    const options = raw.split('|').map((option) => option.trim()).filter((option) => option !== '')
    seen.set(name, options)
  }
  return [...seen].map(([name, options]) => ({ name, options }))
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
