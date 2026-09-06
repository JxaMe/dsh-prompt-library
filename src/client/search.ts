import PinyinMatch from 'pinyin-match'

/** 可搜行：名称与说明（正文不进搜索，列表本就不带正文）。 */
export interface SearchableRow {
  readonly name: string
  readonly description: string
}

/**
 * 提示词匹配：空查询全过；否则名称/说明的子串（含大小写不敏感）或拼音
 * （全拼、首字母、多音字都由 pinyin-match 覆盖）任一命中即算。
 * @param row - 待匹配行。
 * @param query - 用户输入。
 * @returns 是否命中。
 */
export function matchPrompt(row: SearchableRow, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (q === '') return true
  const name = row.name.toLowerCase()
  const description = row.description.toLowerCase()
  if (name.includes(q) || description.includes(q)) return true
  return PinyinMatch.match(row.name, q) !== false || PinyinMatch.match(row.description, q) !== false
}
