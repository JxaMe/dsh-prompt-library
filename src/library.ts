import { PromptLibraryError } from './errors.js'
import type { PromptRecord, PromptVault } from './vault.js'

/** 名称规则：与 slash 命令名同一套，小写开头。 */
export const PROMPT_NAME_RE = /^[a-z][a-z0-9_-]*$/u

/** 建库时一次给定的上限。部署可配，代码里不写死数字。 */
export interface LibraryLimits {
  /** 名称最大长度。 */
  readonly maxNameLength: number
  /** 正文最大字符数。 */
  readonly maxBodyChars: number
  /** 最多存几条。 */
  readonly maxCount: number
}

/**
 * 提示词库：唯一的校验与读写入口。校验顺序固定——
 * 先输入问题（名称形状、长度、正文长度），再状态问题（重名、满额），
 * 调用方看到的第一个错误永远是同一个。
 */
export class PromptLibrary {
  constructor(
    private readonly vault: PromptVault,
    private readonly limits: LibraryLimits,
  ) {}

  /**
   * 按名取一条。
   * @param name - 提示词名称。
   * @returns 记录，没有返回 undefined（不存在不是故障）。
   */
  async get(name: string): Promise<PromptRecord | undefined> {
    return this.vault.get(name)
  }

  /**
   * 列出全部，按名称排序。
   * @returns 全部记录的快照。
   */
  async list(): Promise<readonly PromptRecord[]> {
    const all = await this.vault.all()
    return [...all].sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0)
  }

  /**
   * 按名删一条。不存在不算错。
   * @param name - 提示词名称。
   * @returns 删之前是否存在。
   */
  async remove(name: string): Promise<boolean> {
    return this.vault.delete(name)
  }

  /**
   * 改内容：只换给定的字段，其余原样保留。空 patch 不写库（读一次即返回）。
   * 校验顺序：旧名存在、正文长度。
   * @param name - 提示词名称。
   * @param patch - 要换的字段（至少给一个）。
   */
  async update(name: string, patch: { description?: string; body?: string }): Promise<void> {
    const current = await this.vault.get(name)
    if (current === undefined) {
      throw new PromptLibraryError('missing', `prompt "${name}" does not exist`)
    }
    const next = {
      name,
      description: patch.description ?? current.description,
      body: patch.body ?? current.body,
    }
    if (next.body.length > this.limits.maxBodyChars) {
      throw new PromptLibraryError('body-too-long', `prompt body is ${next.body.length} chars, limit is ${this.limits.maxBodyChars}`)
    }
    if (next.description === current.description && next.body === current.body) return
    await this.vault.put(next)
  }

  /**
   * 改名。内容原样搬过去（delete + put，非原子——单用户场景够用）。
   * 校验顺序：新名形状、新名长度、旧名存在、新名未被占。
   * @param from - 旧名称。
   * @param to - 新名称。
   */
  async rename(from: string, to: string): Promise<void> {
    if (!PROMPT_NAME_RE.test(to)) {
      throw new PromptLibraryError('invalid-name', `invalid prompt name "${to}": use lowercase letters, digits, dash and underscore`)
    }
    if (to.length > this.limits.maxNameLength) {
      throw new PromptLibraryError('name-too-long', `prompt name is ${to.length} chars, limit is ${this.limits.maxNameLength}`)
    }
    const current = await this.vault.get(from)
    if (current === undefined) {
      throw new PromptLibraryError('missing', `prompt "${from}" does not exist`)
    }
    if (await this.vault.get(to) !== undefined) {
      throw new PromptLibraryError('duplicate', `prompt "${to}" already exists`)
    }
    await this.vault.delete(from)
    await this.vault.put({ name: to, description: current.description, body: current.body })
  }

  /**
   * 存一条新的。已存在的名称直接拒绝，不覆盖。
   * @param input - 名称、说明、正文。
   */
  async add(input: { name: string; description: string; body: string }): Promise<void> {
    if (!PROMPT_NAME_RE.test(input.name)) {
      throw new PromptLibraryError('invalid-name', `invalid prompt name "${input.name}": use lowercase letters, digits, dash and underscore`)
    }
    if (input.name.length > this.limits.maxNameLength) {
      throw new PromptLibraryError('name-too-long', `prompt name is ${input.name.length} chars, limit is ${this.limits.maxNameLength}`)
    }
    if (input.body.length > this.limits.maxBodyChars) {
      throw new PromptLibraryError('body-too-long', `prompt body is ${input.body.length} chars, limit is ${this.limits.maxBodyChars}`)
    }
    if (await this.vault.get(input.name) !== undefined) {
      throw new PromptLibraryError('duplicate', `prompt "${input.name}" already exists`)
    }
    if ((await this.vault.all()).length >= this.limits.maxCount) {
      throw new PromptLibraryError('too-many', `prompt library is full (limit is ${this.limits.maxCount})`)
    }
    await this.vault.put({ name: input.name, description: input.description, body: input.body })
  }
}
